import { Effect } from 'effect'
import { eq } from 'drizzle-orm'
import { graphql } from '@octokit/graphql'
import { Octokit } from '@octokit/rest'

import { pullRequests } from '../../../database/schema'
import { getPullRequest, getPullRequestDetails } from '../../bootstrap'
import { MemoryCache } from '../../memory-cache'
import {
  broadcastPullRequestResourceEvents,
  broadcastResourceUpdated
} from '../../send-resource-events'
import { syncPullRequestDetails } from '../../../sync/operations/sync-pull-request-details'
import { BackgroundSyncer } from '../../../sync/services/background-syncer'
import { Database } from '../../../sync/services/database'
import { EtagStore } from '../../../sync/services/etag-store'
import { NotFoundError } from '../../../sync/errors'
import { Repository } from '../../services/repository'
import type { MergeRequirement } from '../../../types/merge-requirements'
import type { PullRequest } from '../../../types/pull-request'
import { OctokitError, ValidationError } from '../errors'
import { octokitErrorOf } from '../octokit-error'

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

const broadcastPullRequestUpdate = (
  pullRequestId: string,
  data: PullRequest | null
) =>
  Effect.sync(() => {
    broadcastResourceUpdated({
      data,
      pullRequestId,
      type: 'pull-request'
    })
  })

const broadcastResourceEvents = (pullRequestId: string) =>
  Effect.promise(() => broadcastPullRequestResourceEvents(pullRequestId))

export const clearFocusedPullRequest = Effect.gen(function* () {
  const syncer = yield* BackgroundSyncer

  yield* Effect.forkDaemon(
    syncer
      .setFocusedPullRequest(null)
      .pipe(
        Effect.catchAll((error) =>
          Effect.sync(() => console.error('Failed to clear focused PR:', error))
        )
      )
  )

  return { success: true } as const
})

export const setFocusedPullRequest = (pullRequestId: string) =>
  Effect.gen(function* () {
    const syncer = yield* BackgroundSyncer

    yield* Effect.forkDaemon(
      syncer
        .setFocusedPullRequest(pullRequestId)
        .pipe(
          Effect.catchAll((error) =>
            Effect.sync(() => console.error('Failed to set focused PR:', error))
          )
        )
    )

    return { success: true } as const
  })

export const activatePullRequest = (pullRequestId: string) =>
  Effect.gen(function* () {
    const repository = yield* Repository
    const syncer = yield* BackgroundSyncer
    const etagStore = yield* EtagStore

    const pullRequest = yield* repository.findPullRequestById(pullRequestId)

    yield* syncer.markPullRequestActive(pullRequestId)

    if (pullRequest) {
      const work = Effect.gen(function* () {
        for (const endpointType of [
          'checks',
          'commits',
          'files',
          'issue_comments',
          'pr-head-sha',
          'review_comments',
          'reviews'
        ]) {
          yield* etagStore
            .remove({ endpointType, resourceId: pullRequestId })
            .pipe(Effect.catchAll(() => Effect.void))
        }

        yield* syncPullRequestDetails({
          owner: pullRequest.repositoryOwner,
          pullNumber: pullRequest.number,
          pullRequestId,
          repositoryName: pullRequest.repositoryName
        }).pipe(
          Effect.catchAll((error) =>
            Effect.sync(() =>
              console.error(
                `Failed to sync details for activated PR ${pullRequestId}:`,
                error
              )
            )
          )
        )

        yield* broadcastResourceEvents(pullRequestId)
      })

      yield* Effect.forkDaemon(work)
    }

    return { success: true } as const
  })

export const fetchPullRequestDetails = (pullRequestId: string) =>
  Effect.tryPromise({
    try: () => getPullRequestDetails(pullRequestId),
    catch: (cause) =>
      new OctokitError({
        message:
          cause instanceof Error ? cause.message : 'Failed to load details',
        operation: 'getPullRequestDetails',
        status: 500
      })
  }).pipe(
    Effect.flatMap((details) =>
      details
        ? Effect.succeed(details)
        : Effect.fail(
            new NotFoundError({
              resourceId: pullRequestId,
              route: 'pull-request.details'
            })
          )
    )
  )

export interface UpdatePullRequestInput {
  readonly body?: string
  readonly isDraft?: boolean
  readonly owner: string
  readonly pullNumber: number
  readonly pullRequestId: string
  readonly repo: string
  readonly state?: 'closed' | 'open'
  readonly title?: string
  readonly token: string
}

export const updatePullRequest = (input: UpdatePullRequestInput) =>
  Effect.gen(function* () {
    if (input.title !== undefined && input.title.trim() === '') {
      return yield* Effect.fail(
        new ValidationError({ field: 'title', message: 'cannot be empty' })
      )
    }

    const repository = yield* Repository
    const database = yield* Database

    const pullRequest = yield* repository.requirePullRequestById(
      input.pullRequestId
    )

    const octokit = new Octokit({ auth: input.token })
    const hasRestUpdate =
      input.title !== undefined ||
      input.body !== undefined ||
      input.state !== undefined

    yield* Effect.tryPromise({
      try: async () => {
        if (hasRestUpdate) {
          await octokit.rest.pulls.update({
            owner: input.owner,
            pull_number: input.pullNumber,
            repo: input.repo,
            ...(input.title !== undefined && { title: input.title }),
            ...(input.body !== undefined && { body: input.body }),
            ...(input.state !== undefined && { state: input.state })
          })
        }

        if (input.isDraft !== undefined) {
          const client = graphql.defaults({
            headers: { authorization: `token ${input.token}` }
          })

          if (input.isDraft) {
            await client(
              `mutation ConvertPullRequestToDraft($id: ID!) {
                convertPullRequestToDraft(input: { pullRequestId: $id }) {
                  pullRequest { id isDraft }
                }
              }`,
              { id: input.pullRequestId }
            )
          } else {
            await client(
              `mutation MarkPullRequestReadyForReview($id: ID!) {
                markPullRequestReadyForReview(input: { pullRequestId: $id }) {
                  pullRequest { id isDraft }
                }
              }`,
              { id: input.pullRequestId }
            )
          }
        }
      },
      catch: octokitErrorOf('updatePullRequest')
    })

    const now = new Date().toISOString()
    const newState =
      input.state === 'closed'
        ? 'CLOSED'
        : input.state === 'open'
          ? 'OPEN'
          : pullRequest.state

    yield* database.use('updatePullRequest.update', (db) => {
      db.update(pullRequests)
        .set({
          ...(input.title !== undefined && { title: input.title }),
          ...(input.body !== undefined && { body: input.body }),
          ...(input.state !== undefined && { state: newState }),
          ...(input.isDraft !== undefined && { isDraft: input.isDraft }),
          updatedAt: now
        })
        .where(eq(pullRequests.id, input.pullRequestId))
        .run()
    })

    const updated = yield* Effect.promise(() =>
      getPullRequest(input.pullRequestId)
    )

    yield* broadcastPullRequestUpdate(input.pullRequestId, updated)

    return updated
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

interface StatusCheckContext {
  conclusion?: string | null
  isRequired: boolean
  state?: string
}

interface StatusCheckRollup {
  contexts: {
    nodes: StatusCheckContext[]
  }
  state: string
}

interface GraphQLMergeStateResponse {
  node: {
    baseRefName: string
    commits: {
      nodes: Array<{
        commit: {
          statusCheckRollup: StatusCheckRollup | null
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

const passingCheckConclusions = new Set(['NEUTRAL', 'SKIPPED', 'SUCCESS'])

const isRequiredCheckPassing = (check: StatusCheckContext): boolean => {
  if ('conclusion' in check) {
    return passingCheckConclusions.has(check.conclusion ?? '')
  }

  if ('state' in check) {
    return check.state === 'SUCCESS'
  }

  return true
}

const areRequiredChecksPassing = (
  rollup: StatusCheckRollup | null | undefined
): boolean => {
  if (!rollup) {
    return true
  }

  return rollup.contexts.nodes.every(
    (check) => !check.isRequired || isRequiredCheckPassing(check)
  )
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
  const rollup = node.commits.nodes[0]?.commit.statusCheckRollup
  const threads = node.reviewThreads.nodes
  const unresolved = threads.filter((thread) => !thread.isResolved).length

  return {
    baseRefName: node.baseRefName,
    isDraft: node.isDraft,
    mergeable: node.mergeable,
    mergeStateStatus: node.mergeStateStatus,
    requiredChecksPassing: areRequiredChecksPassing(rollup),
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

interface BranchProtectionData {
  required_conversation_resolution?: { enabled?: boolean }
  required_pull_request_reviews?: {
    required_approving_review_count?: number
  }
  required_status_checks?: { strict?: boolean }
}

const isNotFoundError = (error: unknown): boolean =>
  error instanceof Error &&
  'status' in error &&
  (error as { status: number }).status === 404

const toBranchProtection = (data: BranchProtectionData): BranchProtection => ({
  requireConversationResolution:
    data.required_conversation_resolution?.enabled ?? false,
  requiredApprovingReviewCount:
    data.required_pull_request_reviews?.required_approving_review_count ?? 0,
  requiresStrictStatusChecks: data.required_status_checks?.strict ?? false
})

async function requestBranchProtection(
  octokit: Octokit,
  owner: string,
  repo: string,
  branch: string
): Promise<BranchProtection | null> {
  try {
    const { data } = await octokit.rest.repos.getBranchProtection({
      branch,
      owner,
      repo
    })

    return toBranchProtection(data)
  } catch (error) {
    if (isNotFoundError(error)) {
      return null
    }

    throw error
  }
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
  const protection = await requestBranchProtection(octokit, owner, repo, branch)

  branchProtectionCache.set(cacheKey, protection, cacheTtl)

  return protection
}

const approvalDescription = (reviewDecision: string | null): string => {
  if (reviewDecision === 'APPROVED') {
    return 'All required reviews have been provided.'
  }

  if (reviewDecision === 'CHANGES_REQUESTED') {
    return 'A reviewer has requested changes.'
  }

  return 'Waiting for required approving reviews.'
}

const approvingReviewsRequirement = (
  state: GraphQLMergeState,
  protection: BranchProtection | null
): MergeRequirement | null => {
  const count = protection?.requiredApprovingReviewCount ?? 0

  if (count < 1) {
    return null
  }

  return {
    description: approvalDescription(state.reviewDecision),
    key: 'approving-reviews',
    label:
      count === 1
        ? '1 approving review required'
        : `${count} approving reviews required`,
    satisfied: state.reviewDecision === 'APPROVED'
  }
}

const branchUpToDateRequirement = (
  state: GraphQLMergeState,
  protection: BranchProtection | null
): MergeRequirement | null => {
  if (!protection?.requiresStrictStatusChecks) {
    return null
  }

  const behind = state.mergeStateStatus === 'BEHIND'

  return {
    description: behind
      ? 'This branch is behind the base branch.'
      : 'Branch is up to date with the base branch.',
    key: 'branch-up-to-date',
    label: 'Branch is up to date',
    satisfied: !behind
  }
}

const conversationsRequirement = (
  state: GraphQLMergeState,
  protection: BranchProtection | null
): MergeRequirement | null => {
  if (!protection?.requireConversationResolution) {
    return null
  }

  const unresolved = state.unresolvedReviewThreads
  const allResolved = unresolved === 0

  return {
    description: allResolved
      ? 'All conversations have been resolved.'
      : `${unresolved} unresolved ${unresolved === 1 ? 'conversation' : 'conversations'}.`,
    key: 'conversations-resolved',
    label: 'Conversations resolved',
    satisfied: allResolved
  }
}

const draftRequirement = (state: GraphQLMergeState): MergeRequirement => ({
  description: state.isDraft
    ? 'This pull request is still a draft.'
    : 'Pull request is ready for review.',
  key: 'not-draft',
  label: 'Not a draft',
  satisfied: !state.isDraft
})

const mergeConflictsRequirement = (
  state: GraphQLMergeState
): MergeRequirement => {
  const hasConflicts = state.mergeable === 'CONFLICTING'

  return {
    description: hasConflicts
      ? 'This branch has conflicts that must be resolved.'
      : 'No merge conflicts.',
    key: 'no-conflicts',
    label: 'No merge conflicts',
    satisfied: !hasConflicts
  }
}

const requiredChecksRequirement = (
  state: GraphQLMergeState,
  protection: BranchProtection | null
): MergeRequirement | null => {
  const failing =
    state.mergeStateStatus === 'UNSTABLE' || !state.requiredChecksPassing

  if (!failing && !protection?.requiresStrictStatusChecks) {
    return null
  }

  return {
    description: failing
      ? 'Some required status checks have not passed.'
      : 'All required status checks have passed.',
    key: 'required-checks',
    label: 'Required checks passing',
    satisfied: !failing
  }
}

export function buildRequirements(
  state: GraphQLMergeState,
  protection: BranchProtection | null
): MergeRequirement[] {
  const candidates = [
    mergeConflictsRequirement(state),
    draftRequirement(state),
    approvingReviewsRequirement(state, protection),
    requiredChecksRequirement(state, protection),
    conversationsRequirement(state, protection),
    branchUpToDateRequirement(state, protection)
  ]

  return candidates.filter(
    (requirement): requirement is MergeRequirement => requirement !== null
  )
}

export const fetchMergeOptions = (input: {
  readonly pullRequestId: string
  readonly token: string
}) =>
  Effect.gen(function* () {
    const repository = yield* Repository
    const pullRequest = yield* repository.requirePullRequestById(
      input.pullRequestId
    )

    const owner = pullRequest.repositoryOwner
    const repo = pullRequest.repositoryName

    const data = yield* Effect.tryPromise({
      try: () =>
        Promise.all([
          fetchMergeStateGraphQL(
            input.token,
            pullRequest.id,
            pullRequest.number
          ),
          fetchRepoSettings(input.token, owner, repo),
          fetchBranchProtection(
            input.token,
            owner,
            repo,
            pullRequest.headRefName ?? ''
          )
        ]),
      catch: octokitErrorOf('fetchMergeOptions')
    })

    const [graphqlData, repoSettings, protection] = data

    const mergeable =
      graphqlData.mergeable === 'MERGEABLE'
        ? true
        : graphqlData.mergeable === 'CONFLICTING'
          ? false
          : null

    const mergeableState = graphqlData.mergeStateStatus.toLowerCase()
    const requirements = buildRequirements(graphqlData, protection)

    return {
      allowMergeCommit: repoSettings.allowMergeCommit,
      allowRebaseMerge: repoSettings.allowRebaseMerge,
      allowSquashMerge: repoSettings.allowSquashMerge,
      mergeable,
      mergeableState,
      requirements
    }
  })

export interface MergePullRequestInput {
  readonly commitMessage?: string
  readonly commitTitle?: string
  readonly mergeMethod: 'merge' | 'rebase' | 'squash'
  readonly owner: string
  readonly pullNumber: number
  readonly pullRequestId: string
  readonly repo: string
  readonly token: string
}

export const mergePullRequest = (input: MergePullRequestInput) =>
  Effect.gen(function* () {
    const repository = yield* Repository
    const database = yield* Database

    yield* repository.requirePullRequestById(input.pullRequestId)

    const octokit = new Octokit({ auth: input.token })

    yield* Effect.tryPromise({
      try: () =>
        octokit.rest.pulls.merge({
          merge_method: input.mergeMethod,
          owner: input.owner,
          pull_number: input.pullNumber,
          repo: input.repo,
          ...(input.commitTitle !== undefined && {
            commit_title: input.commitTitle
          }),
          ...(input.commitMessage !== undefined && {
            commit_message: input.commitMessage
          })
        }),
      catch: octokitErrorOf('pulls.merge')
    })

    const now = new Date().toISOString()

    yield* database.use('mergePullRequest.update', (db) => {
      db.update(pullRequests)
        .set({
          mergedAt: now,
          state: 'MERGED',
          updatedAt: now
        })
        .where(eq(pullRequests.id, input.pullRequestId))
        .run()
    })

    const updated = yield* Effect.promise(() =>
      getPullRequest(input.pullRequestId)
    )

    yield* broadcastPullRequestUpdate(input.pullRequestId, updated)

    return updated
  })

export interface UpdateBranchInput {
  readonly expectedHeadSha?: string
  readonly owner: string
  readonly pullNumber: number
  readonly repo: string
  readonly token: string
}

export const updatePullRequestBranch = (input: UpdateBranchInput) =>
  Effect.gen(function* () {
    const octokit = new Octokit({ auth: input.token })

    yield* Effect.tryPromise({
      try: () =>
        octokit.rest.pulls.updateBranch({
          owner: input.owner,
          pull_number: input.pullNumber,
          repo: input.repo,
          ...(input.expectedHeadSha !== undefined && {
            expected_head_sha: input.expectedHeadSha
          })
        }),
      catch: octokitErrorOf('pulls.updateBranch')
    })

    return { success: true } as const
  })

const knownBotIds: Record<string, string> = {
  'copilot-pull-request-reviewer': 'BOT_kgDOCnlnWA'
}

function partitionLogins(logins: string[]): {
  botIds: string[]
  userLogins: string[]
} {
  const botIds: string[] = []
  const userLogins: string[] = []

  for (const login of logins) {
    const botId = knownBotIds[login]

    if (botId) {
      botIds.push(botId)
    } else {
      userLogins.push(login)
    }
  }

  return { botIds, userLogins }
}

interface RequestedReviewer {
  avatarUrl: string
  login: string
}

interface ReviewRequestsResponse {
  node: {
    reviewRequests: {
      nodes: Array<{
        requestedReviewer:
          | { __typename: 'Bot' | 'User'; avatarUrl: string; login: string }
          | { __typename: string }
          | null
      }>
    }
  } | null
}

const reviewerFragment = `
  reviewRequests(first: 20) {
    nodes {
      requestedReviewer {
        __typename
        ... on User { login avatarUrl }
        ... on Bot { login avatarUrl }
      }
    }
  }
`

interface RequestReviewsMutationResponse {
  requestReviews: {
    pullRequest: {
      reviewRequests: {
        nodes: Array<{
          requestedReviewer:
            | { __typename: 'Bot' | 'User'; avatarUrl: string; login: string }
            | { __typename: string }
            | null
        }>
      }
    }
  }
}

function extractReviewers(
  response: RequestReviewsMutationResponse
): RequestedReviewer[] {
  const nodes = response.requestReviews.pullRequest.reviewRequests.nodes

  return nodes.flatMap((entry) => {
    const reviewer = entry.requestedReviewer

    if (
      !reviewer ||
      (reviewer.__typename !== 'User' && reviewer.__typename !== 'Bot')
    ) {
      return []
    }

    const typed = reviewer as { avatarUrl: string; login: string }

    return [{ avatarUrl: typed.avatarUrl, login: typed.login }]
  })
}

async function fetchRequestedReviewers(
  token: string,
  pullRequestNodeId: string
): Promise<RequestedReviewer[]> {
  const client = graphql.defaults({
    headers: { authorization: `token ${token}` }
  })

  const response = await client<ReviewRequestsResponse>(
    `query GetReviewRequests($id: ID!) {
      node(id: $id) {
        ... on PullRequest {
          reviewRequests(first: 20) {
            nodes {
              requestedReviewer {
                __typename
                ... on User { login avatarUrl }
                ... on Bot { login avatarUrl }
              }
            }
          }
        }
      }
    }`,
    { id: pullRequestNodeId }
  )

  const nodes = response.node?.reviewRequests.nodes ?? []

  return nodes.flatMap((entry) => {
    const reviewer = entry.requestedReviewer

    if (
      !reviewer ||
      (reviewer.__typename !== 'User' && reviewer.__typename !== 'Bot')
    ) {
      return []
    }

    const typed = reviewer as { avatarUrl: string; login: string }

    return [{ avatarUrl: typed.avatarUrl, login: typed.login }]
  })
}

async function requestBotReviewers(
  token: string,
  pullRequestNodeId: string,
  botIds: string[]
): Promise<RequestedReviewer[]> {
  const client = graphql.defaults({
    headers: { authorization: `token ${token}` }
  })

  const response = await client<RequestReviewsMutationResponse>(
    `mutation RequestBotReviewers($pullRequestId: ID!, $botIds: [ID!]) {
      requestReviews(input: {
        pullRequestId: $pullRequestId,
        botIds: $botIds,
        union: true
      }) {
        pullRequest {
          ${reviewerFragment}
        }
      }
    }`,
    { pullRequestId: pullRequestNodeId, botIds }
  )

  return extractReviewers(response)
}

async function removeBotReviewers(
  token: string,
  pullRequestNodeId: string,
  botIdsToRemove: string[]
): Promise<RequestedReviewer[]> {
  const current = await fetchRequestedReviewers(token, pullRequestNodeId)
  const removeSet = new Set(
    botIdsToRemove
      .map((id) =>
        Object.keys(knownBotIds).find((login) => knownBotIds[login] === id)
      )
      .filter((login): login is string => Boolean(login))
  )

  const kept = current.filter((reviewer) => !removeSet.has(reviewer.login))
  const keptUserLogins = kept
    .map((reviewer) => reviewer.login)
    .filter((login) => !knownBotIds[login])
  const keptBotIds = kept
    .map((reviewer) => knownBotIds[reviewer.login])
    .filter((id): id is string => Boolean(id))

  const client = graphql.defaults({
    headers: { authorization: `token ${token}` }
  })

  const response = await client<RequestReviewsMutationResponse>(
    `mutation ReplaceReviewers(
      $pullRequestId: ID!,
      $userLogins: [String!],
      $botIds: [ID!]
    ) {
      requestReviews(input: {
        pullRequestId: $pullRequestId,
        userLogins: $userLogins,
        botIds: $botIds,
        union: false
      }) {
        pullRequest {
          ${reviewerFragment}
        }
      }
    }`,
    {
      botIds: keptBotIds,
      pullRequestId: pullRequestNodeId,
      userLogins: keptUserLogins
    }
  )

  return extractReviewers(response)
}

type RestReviewerMutation = (
  octokit: Octokit,
  params: {
    owner: string
    pull_number: number
    repo: string
    reviewers: string[]
  }
) => Promise<unknown>

export interface ReviewerMutationInput {
  readonly logins: ReadonlyArray<string>
  readonly pullRequestId: string
  readonly token: string
}

const applyReviewerMutation = (
  input: ReviewerMutationInput,
  mode: 'add' | 'remove',
  restMutation: RestReviewerMutation
) =>
  Effect.gen(function* () {
    const repository = yield* Repository
    const database = yield* Database
    const pullRequest = yield* repository.requirePullRequestById(
      input.pullRequestId
    )

    const logins = input.logins.filter((login) => login.length > 0)

    if (logins.length === 0) {
      return yield* Effect.fail(
        new ValidationError({ field: 'logins', message: 'is required' })
      )
    }

    const { botIds, userLogins } = partitionLogins([...logins])
    const octokit = new Octokit({ auth: input.token })

    if (userLogins.length > 0) {
      yield* Effect.tryPromise({
        try: () =>
          restMutation(octokit, {
            owner: pullRequest.repositoryOwner,
            pull_number: pullRequest.number,
            repo: pullRequest.repositoryName,
            reviewers: userLogins
          }),
        catch: octokitErrorOf(`reviewers.${mode}`)
      })
    }

    const updatedReviewers = yield* Effect.tryPromise({
      try: () => {
        if (botIds.length > 0) {
          return mode === 'add'
            ? requestBotReviewers(input.token, pullRequest.id, botIds)
            : removeBotReviewers(input.token, pullRequest.id, botIds)
        }

        return fetchRequestedReviewers(input.token, pullRequest.id)
      },
      catch: (error) => {
        console.error('Failed to refresh reviewers after mutation:', error)

        return new OctokitError({
          message:
            error instanceof Error
              ? error.message
              : 'Failed to refresh reviewers',
          operation: `reviewers.${mode}.refresh`,
          status: 500
        })
      }
    }).pipe(Effect.catchAll(() => Effect.succeed<RequestedReviewer[]>([])))

    yield* database.use(`reviewers.${mode}.update`, (db) => {
      db.update(pullRequests)
        .set({
          requestedReviewers: JSON.stringify(updatedReviewers),
          syncedAt: new Date().toISOString()
        })
        .where(eq(pullRequests.id, input.pullRequestId))
        .run()
    })

    const updated = yield* Effect.promise(() =>
      getPullRequest(input.pullRequestId)
    )

    if (updated) {
      yield* broadcastPullRequestUpdate(input.pullRequestId, updated)
    }

    return updated
  })

export const addReviewers = (input: ReviewerMutationInput) =>
  applyReviewerMutation(input, 'add', (octokit, params) =>
    octokit.rest.pulls.requestReviewers(params)
  )

export const removeReviewers = (input: ReviewerMutationInput) =>
  applyReviewerMutation(input, 'remove', (octokit, params) =>
    octokit.rest.pulls.removeRequestedReviewers(params)
  )

export const syncPullRequestNow = (pullRequestId: string) =>
  Effect.gen(function* () {
    const repository = yield* Repository
    const pullRequest = yield* repository.requirePullRequestById(pullRequestId)

    const result = yield* syncPullRequestDetails({
      owner: pullRequest.repositoryOwner,
      pullNumber: pullRequest.number,
      pullRequestId,
      repositoryName: pullRequest.repositoryName
    })

    yield* broadcastResourceEvents(pullRequestId)

    return result
  })
