import fs from 'fs'

import type { Octokit } from '@octokit/rest'

import { buildIssueCommentBody, buildSummaryBody, issueSlug } from './format'
import { findRobotThreads } from './threads'
import type { Issue, Review, ReviewThread } from './types'

const reviewThreadsQuery = `
  query($owner: String!, $repo: String!, $prNumber: Int!, $cursor: String) {
    repository(owner: $owner, name: $repo) {
      pullRequest(number: $prNumber) {
        reviewThreads(first: 100, after: $cursor) {
          pageInfo {
            hasNextPage
            endCursor
          }
          nodes {
            id
            isResolved
            comments(first: 1) {
              nodes {
                id
                databaseId
                body
                path
                line
              }
            }
          }
        }
      }
    }
  }
`

export function parseReviewFile(path: string): Review | null {
  console.log(`Parsing review file: ${path}`)

  if (!fs.existsSync(path)) {
    console.warn('review.json not found — skipping review comments.')

    return null
  }

  try {
    const raw = JSON.parse(fs.readFileSync(path, 'utf8'))

    // opencode -f json wraps output in { "response": "..." }.
    const unwrapped = typeof raw.response === 'string'
    const content = unwrapped ? raw.response : JSON.stringify(raw)

    console.log(`Opencode JSON envelope: ${unwrapped ? 'unwrapped' : 'not present'}`)

    const jsonText = content
      .replace(/^```(?:json)?\s*\n?/, '')
      .replace(/\n?```\s*$/, '')

    const review: Review = JSON.parse(jsonText)

    console.log(`Parsed ${review.issues?.length ?? 0} issues from review file.`)

    return review
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.warn(`Failed to parse review.json: ${message}`)

    return null
  }
}

export async function fetchExistingReviewThreads(
  octokit: Octokit,
  owner: string,
  repo: string,
  prNumber: number
): Promise<ReviewThread[]> {
  const threads: ReviewThread[] = []
  let cursor: string | null = null

  while (true) {
    const result: Record<string, unknown> = await octokit.graphql(
      reviewThreadsQuery,
      { owner, repo, prNumber, cursor }
    )

    const reviewThreads = (
      result as {
        repository: {
          pullRequest: {
            reviewThreads: {
              nodes: ReviewThread[]
              pageInfo: { endCursor: string; hasNextPage: boolean }
            }
          }
        }
      }
    ).repository.pullRequest.reviewThreads

    threads.push(...reviewThreads.nodes)

    if (!reviewThreads.pageInfo.hasNextPage) {
      break
    }

    cursor = reviewThreads.pageInfo.endCursor
  }

  console.log(`Fetched ${threads.length} existing review threads.`)

  return threads
}

interface PostReviewParams {
  commitSha: string
  owner: string
  prNumber: number
  repo: string
  reviewPath: string
}

export async function postReview(
  octokit: Octokit,
  params: PostReviewParams
): Promise<void> {
  const { commitSha, owner, prNumber, repo, reviewPath } = params

  const review = parseReviewFile(reviewPath)

  if (!review) {
    return
  }

  const summary = review.summary ?? 'No summary provided.'
  const allIssues: Issue[] = review.issues ?? []

  console.log(`Review: ${allIssues.length} issues, summary length ${summary.length} chars.`)

  // Filter issues to only include files that are part of the PR diff.
  // The GitHub API returns 422 if a path doesn't match the diff.

  const { data: prFiles } = await octokit.rest.pulls.listFiles({
    owner,
    repo,
    pull_number: prNumber,
    per_page: 100,
  })

  const validPaths = new Set(prFiles.map((file) => file.filename))
  const issues = allIssues.filter((issue) => {
    if (validPaths.has(issue.file)) {
      return true
    }

    console.warn(`Skipping issue on "${issue.file}" — not in PR diff.`)

    return false
  })

  console.log(`${issues.length} issues on files in the PR diff.`)

  // Handle issue comments — one thread per issue.

  const threads = await fetchExistingReviewThreads(
    octokit,
    owner,
    repo,
    prNumber
  )
  const robotThreads = findRobotThreads(threads)
  const postedIssues: Issue[] = []
  const newComments: Array<{ body: string; issue: Issue; line: number; path: string }> = []

  console.log(`Found ${robotThreads.size} existing robot threads.`)

  for (const issue of issues) {
    const slug = issueSlug(issue.file, issue.title)
    const body = buildIssueCommentBody(issue)
    const existing = robotThreads.get(slug)

    if (existing) {
      console.log(`Updating existing thread for: ${slug}`)

      await octokit.rest.pulls.updateReviewComment({
        owner,
        repo,
        comment_id: existing.commentId,
        body,
      })

      robotThreads.delete(slug)
      postedIssues.push(issue)
    } else {
      console.log(`New thread for: ${slug}`)

      newComments.push({
        body,
        issue,
        line: issue.line ?? 1,
        path: issue.file,
      })
    }
  }

  // Resolve unresolved robot threads whose issues are no longer present.

  console.log(`Resolving ${robotThreads.size} stale threads.`)

  for (const [, thread] of robotThreads) {
    try {
      await octokit.graphql(
        `
        mutation($threadId: ID!) {
          resolveReviewThread(input: { threadId: $threadId }) {
            thread { id }
          }
        }
      `,
        { threadId: thread.threadId }
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.warn(`Could not resolve thread ${thread.threadId} — ${message}`)
    }
  }

  // Post new issue comments one at a time. The API rejects the entire batch
  // if any line number falls outside the diff, so posting individually lets
  // valid comments go through even when some lines can't be resolved.

  console.log(`Posting ${newComments.length} new comments as reviews.`)

  for (const comment of newComments) {
    try {
      await octokit.rest.pulls.createReview({
        owner,
        repo,
        pull_number: prNumber,
        commit_id: commitSha,
        event: 'COMMENT',
        comments: [{ body: comment.body, line: comment.line, path: comment.path }],
      })

      postedIssues.push(comment.issue)
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.warn(`Skipping comment on "${comment.path}:${comment.line}" — ${message}`)
    }
  }

  // Post or update the summary comment with only the issues that were posted.

  const summaryBody = buildSummaryBody(summary, postedIssues)
  const { data: existingComments } = await octokit.rest.issues.listComments({
    owner,
    repo,
    issue_number: prNumber,
    per_page: 100,
  })

  const existingSummary = existingComments.find((comment) =>
    comment.body?.includes('<!-- robot-code-review-summary -->')
  )

  console.log(`Summary comment: ${existingSummary ? 'updating existing' : 'creating new'} with ${postedIssues.length} issues.`)

  if (existingSummary) {
    await octokit.rest.issues.updateComment({
      owner,
      repo,
      comment_id: existingSummary.id,
      body: summaryBody,
    })
  } else {
    await octokit.rest.issues.createComment({
      owner,
      repo,
      issue_number: prNumber,
      body: summaryBody,
    })
  }
}
