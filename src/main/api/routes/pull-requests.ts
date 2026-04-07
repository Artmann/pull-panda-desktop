import { BrowserWindow } from 'electron'
import { Hono } from 'hono'
import { and, eq } from 'drizzle-orm'
import { graphql } from '@octokit/graphql'
import { Octokit } from '@octokit/rest'

import { getDatabase } from '../../../database'
import { pullRequests } from '../../../database/schema'
import { ipcChannels } from '../../../lib/ipc/channels'
import { backgroundSyncer } from '../../background-syncer'
import { getPullRequest, getPullRequestDetails } from '../../bootstrap'
import { MemoryCache } from '../../memory-cache'
import { sendPullRequestResourceEvents } from '../../send-resource-events'
import { etagManager } from '../../../sync/etag-manager'
import { syncPullRequestDetails } from '../../../sync/sync-pull-request-details'
import type { MergeRequirement } from '../../../types/merge-requirements'

import type { AppEnv } from './comments'

const cacheTtl = 5 * 60 * 1000

interface RepoSettings {
  allowMergeCommit: boolean
  allowRebaseMerge: boolean
  allowSquashMerge: boolean
}

interface BranchProtection {
  requireConversationResolution: boolean
  requiredApprovingReviewCount: number
  requiresStrictStatusChecks: boolean
}

const repoSettingsCache = new MemoryCache<RepoSettings>()
const branchProtectionCache = new MemoryCache<BranchProtection | null>()

export const pullRequestsRoute = new Hono<AppEnv>()

pullRequestsRoute.post('/:pullRequestId/activate', (context) => {
  const token = context.get('token')
  const pullRequestId = context.req.param('pullRequestId')

  if (!pullRequestId) {
    return context.json({ error: 'Missing pull request ID' }, 400)
  }

  backgroundSyncer.markPullRequestActive(pullRequestId)

  // Fire-and-forget detail sync so the user gets fresh data immediately
  const database = getDatabase()

  const pullRequest = database
    .select()
    .from(pullRequests)
    .where(eq(pullRequests.id, pullRequestId))
    .get()

  if (pullRequest) {
    // Clear cached ETags so force pushes and amended commits are picked up.
    for (const endpointType of ['checks', 'commits', 'files', 'reviews', 'comments']) {
      etagManager.delete({ endpointType, resourceId: pullRequestId })
    }

    syncPullRequestDetails({
      token,
      pullRequestId,
      owner: pullRequest.repositoryOwner,
      repositoryName: pullRequest.repositoryName,
      pullNumber: pullRequest.number
    })
      .then(() => {
        for (const window of BrowserWindow.getAllWindows()) {
          sendPullRequestResourceEvents(window, pullRequestId)
        }
      })
      .catch((error) => {
        console.error(
          `Failed to sync details for activated PR ${pullRequestId}:`,
          error
        )
      })
  }

  return context.json({ success: true })
})

pullRequestsRoute.get('/:pullRequestId/details', async (context) => {
  const pullRequestId = context.req.param('pullRequestId')

  if (!pullRequestId) {
    return context.json({ error: 'Missing pull request ID' }, 400)
  }

  const details = await getPullRequestDetails(pullRequestId)

  if (!details) {
    return context.json({ error: 'Pull request details not found' }, 404)
  }

  return context.json(details)
})

interface UpdatePullRequestBody {
  body?: string
  isDraft?: boolean
  owner: string
  pullNumber: number
  repo: string
  state?: 'open' | 'closed'
  title?: string
}

pullRequestsRoute.patch('/:pullRequestId', async (context) => {
  const token = context.get('token')
  const pullRequestId = context.req.param('pullRequestId')

  if (!pullRequestId) {
    return context.json({ error: 'Missing pull request ID' }, 400)
  }

  const request = await context.req.json<UpdatePullRequestBody>()

  if (request.title !== undefined && request.title.trim() === '') {
    return context.json({ error: 'Title cannot be empty' }, 400)
  }

  const database = getDatabase()

  const pullRequest = database
    .select()
    .from(pullRequests)
    .where(eq(pullRequests.id, pullRequestId))
    .get()

  if (!pullRequest) {
    return context.json({ error: 'Pull request not found' }, 404)
  }

  const octokit = new Octokit({ auth: token })

  try {
    await octokit.rest.pulls.update({
      owner: request.owner,
      repo: request.repo,
      pull_number: request.pullNumber,
      ...(request.title !== undefined && { title: request.title }),
      ...(request.body !== undefined && { body: request.body }),
      ...(request.state !== undefined && { state: request.state }),
      ...(request.isDraft !== undefined && { draft: request.isDraft })
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'

    console.error('Failed to update pull request:', error)

    return context.json({ error: message }, 500)
  }

  const now = new Date().toISOString()
  const newState =
    request.state === 'closed'
      ? 'CLOSED'
      : request.state === 'open'
        ? 'OPEN'
        : pullRequest.state

  database
    .update(pullRequests)
    .set({
      ...(request.title !== undefined && { title: request.title }),
      ...(request.body !== undefined && { body: request.body }),
      ...(request.state !== undefined && { state: newState }),
      ...(request.isDraft !== undefined && { isDraft: request.isDraft }),
      updatedAt: now
    })
    .where(eq(pullRequests.id, pullRequestId))
    .run()

  const updated = await getPullRequest(pullRequestId)

  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send(ipcChannels.ResourceUpdated, {
      data: updated,
      pullRequestId,
      type: 'pull-request'
    })
  }

  return context.json(updated)
})

pullRequestsRoute.get('/:pullRequestId/merge-options', async (context) => {
  const token = context.get('token')
  const pullRequestId = context.req.param('pullRequestId')

  if (!pullRequestId) {
    return context.json({ error: 'Missing pull request ID' }, 400)
  }

  const database = getDatabase()

  const pullRequest = database
    .select()
    .from(pullRequests)
    .where(eq(pullRequests.id, pullRequestId))
    .get()

  if (!pullRequest) {
    return context.json({ error: 'Pull request not found' }, 404)
  }

  const owner = pullRequest.repositoryOwner
  const repo = pullRequest.repositoryName

  try {
    const [graphqlData, repoSettings, protection] = await Promise.all([
      fetchMergeStateGraphQL(token, pullRequest.id, pullRequest.number),
      fetchRepoSettings(token, owner, repo),
      fetchBranchProtection(token, owner, repo, pullRequest.headRefName ?? '')
    ])

    const mergeable = graphqlData.mergeable === 'MERGEABLE'
      ? true
      : graphqlData.mergeable === 'CONFLICTING'
        ? false
        : null

    const mergeableState = graphqlData.mergeStateStatus.toLowerCase()
    const requirements = buildRequirements(graphqlData, protection)

    return context.json({
      allowMergeCommit: repoSettings.allowMergeCommit,
      allowRebaseMerge: repoSettings.allowRebaseMerge,
      allowSquashMerge: repoSettings.allowSquashMerge,
      mergeable,
      mergeableState,
      requirements
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'

    console.error('Failed to fetch merge options:', error)

    return context.json({ error: message }, 500)
  }
})

interface GraphQLMergeState {
  baseRefName: string
  isDraft: boolean
  mergeable: string
  mergeStateStatus: string
  requiredChecksPassing: boolean
  reviewDecision: string | null
  totalReviewThreads: number
  unresolvedReviewThreads: number
}

const mergeStateQuery = `
  query MergeState($id: ID!, $number: Int!) {
    node(id: $id) {
      ... on PullRequest {
        baseRefName
        isDraft
        mergeable
        mergeStateStatus
        reviewDecision
        reviewThreads(first: 100) {
          totalCount
          nodes {
            isResolved
          }
        }
        commits(last: 1) {
          nodes {
            commit {
              statusCheckRollup {
                state
                contexts(first: 100) {
                  nodes {
                    ... on CheckRun {
                      conclusion
                      isRequired(pullRequestNumber: $number)
                    }
                    ... on StatusContext {
                      state
                      isRequired(pullRequestNumber: $number)
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
  }
`

interface GraphQLMergeStateResponse {
  node: {
    baseRefName: string
    commits: {
      nodes: Array<{
        commit: {
          statusCheckRollup: {
            contexts: {
              nodes: Array<{
                conclusion?: string | null
                isRequired: boolean
                state?: string
              }>
            }
            state: string
          } | null
        }
      }>
    }
    isDraft: boolean
    mergeable: string
    mergeStateStatus: string
    reviewDecision: string | null
    reviewThreads: {
      nodes: Array<{ isResolved: boolean }>
      totalCount: number
    }
  }
}

async function fetchMergeStateGraphQL(
  token: string,
  nodeId: string,
  pullNumber: number
): Promise<GraphQLMergeState> {
  const client = graphql.defaults({
    headers: { authorization: `token ${token}` }
  })

  const response = await client<GraphQLMergeStateResponse>(mergeStateQuery, {
    id: nodeId,
    number: pullNumber
  })

  const node = response.node
  const threads = node.reviewThreads.nodes
  const unresolved = threads.filter((thread) => !thread.isResolved).length

  const commitNode = node.commits.nodes[0]
  const rollup = commitNode?.commit.statusCheckRollup
  let requiredChecksPassing = true

  if (rollup) {
    for (const check of rollup.contexts.nodes) {
      if (!check.isRequired) {
        continue
      }

      if ('conclusion' in check) {
        if (
          check.conclusion !== 'SUCCESS' &&
          check.conclusion !== 'NEUTRAL' &&
          check.conclusion !== 'SKIPPED'
        ) {
          requiredChecksPassing = false
          break
        }
      } else if ('state' in check) {
        if (check.state !== 'SUCCESS') {
          requiredChecksPassing = false
          break
        }
      }
    }
  }

  return {
    baseRefName: node.baseRefName,
    isDraft: node.isDraft,
    mergeable: node.mergeable,
    mergeStateStatus: node.mergeStateStatus,
    requiredChecksPassing,
    reviewDecision: node.reviewDecision,
    totalReviewThreads: node.reviewThreads.totalCount,
    unresolvedReviewThreads: unresolved
  }
}

async function fetchRepoSettings(
  token: string,
  owner: string,
  repo: string
): Promise<RepoSettings> {
  const cacheKey = `${owner}/${repo}`
  const cached = repoSettingsCache.get(cacheKey)

  if (cached) {
    return cached
  }

  const octokit = new Octokit({ auth: token })
  const { data } = await octokit.rest.repos.get({ owner, repo })

  const settings: RepoSettings = {
    allowMergeCommit: data.allow_merge_commit ?? true,
    allowRebaseMerge: data.allow_rebase_merge ?? true,
    allowSquashMerge: data.allow_squash_merge ?? true
  }

  repoSettingsCache.set(cacheKey, settings, cacheTtl)

  return settings
}

async function fetchBranchProtection(
  token: string,
  owner: string,
  repo: string,
  branch: string
): Promise<BranchProtection | null> {
  if (!branch) {
    return null
  }

  const cacheKey = `${owner}/${repo}/${branch}`
  const cached = branchProtectionCache.get(cacheKey)

  if (cached !== null) {
    return cached
  }

  const octokit = new Octokit({ auth: token })

  try {
    const { data } = await octokit.rest.repos.getBranchProtection({
      branch,
      owner,
      repo
    })

    const protection: BranchProtection = {
      requireConversationResolution:
        data.required_conversation_resolution?.enabled ?? false,
      requiredApprovingReviewCount:
        data.required_pull_request_reviews
          ?.required_approving_review_count ?? 0,
      requiresStrictStatusChecks:
        data.required_status_checks?.strict ?? false
    }

    branchProtectionCache.set(cacheKey, protection, cacheTtl)

    return protection
  } catch (error) {
    if (
      error instanceof Error &&
      'status' in error &&
      (error as { status: number }).status === 404
    ) {
      branchProtectionCache.set(cacheKey, null, cacheTtl)

      return null
    }

    throw error
  }
}

function buildRequirements(
  state: GraphQLMergeState,
  protection: BranchProtection | null
): MergeRequirement[] {
  const requirements: MergeRequirement[] = []

  // Always show conflict status.
  const hasConflicts = state.mergeable === 'CONFLICTING'

  requirements.push({
    description: hasConflicts
      ? 'This branch has conflicts that must be resolved.'
      : 'No merge conflicts.',
    key: 'no-conflicts',
    label: 'No merge conflicts',
    satisfied: !hasConflicts
  })

  // Always show draft status.
  requirements.push({
    description: state.isDraft
      ? 'This pull request is still a draft.'
      : 'Pull request is ready for review.',
    key: 'not-draft',
    label: 'Not a draft',
    satisfied: !state.isDraft
  })

  // Show review requirement when branch protection requires reviews.
  if (protection && protection.requiredApprovingReviewCount > 0) {
    const approved = state.reviewDecision === 'APPROVED'
    const count = protection.requiredApprovingReviewCount
    const label = count === 1
      ? '1 approving review required'
      : `${count} approving reviews required`

    requirements.push({
      description: approved
        ? 'All required reviews have been provided.'
        : state.reviewDecision === 'CHANGES_REQUESTED'
          ? 'A reviewer has requested changes.'
          : 'Waiting for required approving reviews.',
      key: 'approving-reviews',
      label,
      satisfied: approved
    })
  }

  // Show required checks when there are any required status checks.
  if (state.mergeStateStatus === 'UNSTABLE' || !state.requiredChecksPassing) {
    requirements.push({
      description: 'Some required status checks have not passed.',
      key: 'required-checks',
      label: 'Required checks passing',
      satisfied: false
    })
  } else if (protection && protection.requiresStrictStatusChecks) {
    requirements.push({
      description: 'All required status checks have passed.',
      key: 'required-checks',
      label: 'Required checks passing',
      satisfied: true
    })
  }

  // Show conversation resolution when branch protection requires it.
  if (protection && protection.requireConversationResolution) {
    const allResolved = state.unresolvedReviewThreads === 0
    const unresolved = state.unresolvedReviewThreads

    requirements.push({
      description: allResolved
        ? 'All conversations have been resolved.'
        : `${unresolved} unresolved ${unresolved === 1 ? 'conversation' : 'conversations'}.`,
      key: 'conversations-resolved',
      label: 'Conversations resolved',
      satisfied: allResolved
    })
  }

  // Show branch up-to-date when strict status checks are enabled.
  if (protection && protection.requiresStrictStatusChecks) {
    const behind = state.mergeStateStatus === 'BEHIND'

    requirements.push({
      description: behind
        ? 'This branch is behind the base branch.'
        : 'Branch is up to date with the base branch.',
      key: 'branch-up-to-date',
      label: 'Branch is up to date',
      satisfied: !behind
    })
  }

  return requirements
}

interface MergePullRequestBody {
  commitMessage?: string
  commitTitle?: string
  mergeMethod: 'merge' | 'squash' | 'rebase'
  owner: string
  pullNumber: number
  repo: string
}

pullRequestsRoute.post('/:pullRequestId/merge', async (context) => {
  const token = context.get('token')
  const pullRequestId = context.req.param('pullRequestId')

  if (!pullRequestId) {
    return context.json({ error: 'Missing pull request ID' }, 400)
  }

  const request = await context.req.json<MergePullRequestBody>()
  const database = getDatabase()

  const pullRequest = database
    .select()
    .from(pullRequests)
    .where(eq(pullRequests.id, pullRequestId))
    .get()

  if (!pullRequest) {
    return context.json({ error: 'Pull request not found' }, 404)
  }

  const octokit = new Octokit({ auth: token })

  try {
    await octokit.rest.pulls.merge({
      owner: request.owner,
      repo: request.repo,
      pull_number: request.pullNumber,
      merge_method: request.mergeMethod,
      ...(request.commitTitle !== undefined && {
        commit_title: request.commitTitle
      }),
      ...(request.commitMessage !== undefined && {
        commit_message: request.commitMessage
      })
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'

    console.error('Failed to merge pull request:', error)

    return context.json({ error: message }, 500)
  }

  const now = new Date().toISOString()

  database
    .update(pullRequests)
    .set({
      state: 'MERGED',
      mergedAt: now,
      updatedAt: now
    })
    .where(eq(pullRequests.id, pullRequestId))
    .run()

  const updated = await getPullRequest(pullRequestId)

  for (const window of BrowserWindow.getAllWindows()) {
    window.webContents.send(ipcChannels.ResourceUpdated, {
      data: updated,
      pullRequestId,
      type: 'pull-request'
    })
  }

  return context.json(updated)
})

pullRequestsRoute.post('/:pullRequestId/sync', async (context) => {
  const token = context.get('token')
  const pullRequestId = context.req.param('pullRequestId')

  if (!pullRequestId) {
    return context.json({ error: 'Missing pull request ID' }, 400)
  }

  const database = getDatabase()

  const pullRequest = database
    .select()
    .from(pullRequests)
    .where(and(eq(pullRequests.id, pullRequestId)))
    .get()

  if (!pullRequest) {
    return context.json({ error: 'Pull request not found' }, 404)
  }

  const result = await syncPullRequestDetails({
    token,
    pullRequestId,
    owner: pullRequest.repositoryOwner,
    repositoryName: pullRequest.repositoryName,
    pullNumber: pullRequest.number
  })

  // Send resource events to all windows
  for (const window of BrowserWindow.getAllWindows()) {
    await sendPullRequestResourceEvents(window, pullRequestId)
  }

  return context.json(result)
})
