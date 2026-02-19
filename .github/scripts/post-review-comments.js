const fs = require('fs')
const path = require('path')

const summaryMarker = '<!-- robot-code-review -->\n<!-- robot-code-review-summary -->'
const commentMarker = '<!-- robot-code-review -->'

const severityEmoji = {
  critical: '\u{1F534}',
  major: '\u{1F7E0}',
  minor: '\u{1F7E1}',
}

const severityLabel = {
  critical: 'Critical',
  major: 'Major',
  minor: 'Minor',
}

function issueSlug(file, title) {
  return `${file}-${title}`.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-')
}

function issueMarker(slug) {
  return `<!-- robot-issue: ${slug} -->`
}

function buildSummaryBody(summary, issues) {
  let body = `${summaryMarker}\n\n## Robot Code Review\n\n${summary}\n`

  if (issues.length === 0) {
    return `${summaryMarker}\n\nLooks good to me! :rocket:`
  }

  body += '\n### Issues\n\n'

  for (const issue of issues) {
    const emoji = severityEmoji[issue.severity] ?? ''
    const label = severityLabel[issue.severity] ?? issue.severity
    body += `- ${emoji} **${label}:** ${issue.title} — \`${issue.file}:${issue.line}\`\n`
  }

  return body
}

function buildIssueCommentBody(issue) {
  const slug = issueSlug(issue.file, issue.title)
  const emoji = severityEmoji[issue.severity] ?? ''
  const label = severityLabel[issue.severity] ?? issue.severity

  return `${commentMarker}\n${issueMarker(slug)}\n\n### ${emoji} ${label}: ${issue.title}\n\n${issue.description}`
}

async function fetchExistingReviewThreads(github, owner, repo, prNumber) {
  const query = `
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

  const threads = []
  let cursor = null

  while (true) {
    const result = await github.graphql(query, {
      owner,
      repo,
      prNumber,
      cursor,
    })

    const reviewThreads = result.repository.pullRequest.reviewThreads
    threads.push(...reviewThreads.nodes)

    if (!reviewThreads.pageInfo.hasNextPage) {
      break
    }

    cursor = reviewThreads.pageInfo.endCursor
  }

  return threads
}

function findRobotThreads(threads) {
  const robotThreads = new Map()

  for (const thread of threads) {
    const firstComment = thread.comments.nodes[0]

    if (!firstComment || !firstComment.body.includes(commentMarker)) {
      continue
    }

    // Skip resolved threads — the user resolved them intentionally.
    if (thread.isResolved) {
      continue
    }

    const slugMatch = firstComment.body.match(/<!-- robot-issue: (.+?) -->/)

    if (slugMatch) {
      robotThreads.set(slugMatch[1], {
        threadId: thread.id,
        commentId: firstComment.databaseId,
      })
    }
  }

  return robotThreads
}

module.exports = async ({ github, context, core }) => {
  const owner = context.repo.owner
  const repo = context.repo.repo
  const prNumber = context.payload.pull_request.number
  const commitSha = context.payload.pull_request.head.sha

  const reviewPath = path.join(process.env.GITHUB_WORKSPACE ?? '.', 'review.json')

  if (!fs.existsSync(reviewPath)) {
    core.warning('review.json not found — skipping review comments.')

    return
  }

  let review

  try {
    review = JSON.parse(fs.readFileSync(reviewPath, 'utf8'))
  } catch (error) {
    core.warning(`Failed to parse review.json: ${error.message}`)

    return
  }

  const summary = review.summary ?? 'No summary provided.'
  const issues = review.issues ?? []

  // Post or update summary comment.

  const summaryBody = buildSummaryBody(summary, issues)
  const { data: existingComments } = await github.rest.issues.listComments({
    owner,
    repo,
    issue_number: prNumber,
    per_page: 100,
  })

  const existingSummary = existingComments.find((comment) =>
    comment.body.includes('<!-- robot-code-review-summary -->')
  )

  if (existingSummary) {
    await github.rest.issues.updateComment({
      owner,
      repo,
      comment_id: existingSummary.id,
      body: summaryBody,
    })
  } else {
    await github.rest.issues.createComment({
      owner,
      repo,
      issue_number: prNumber,
      body: summaryBody,
    })
  }

  // Handle issue comments — one thread per issue.

  const threads = await fetchExistingReviewThreads(github, owner, repo, prNumber)
  const robotThreads = findRobotThreads(threads)
  const newComments = []

  for (const issue of issues) {
    const slug = issueSlug(issue.file, issue.title)
    const body = buildIssueCommentBody(issue)
    const existing = robotThreads.get(slug)

    if (existing) {
      await github.rest.pulls.updateReviewComment({
        owner,
        repo,
        comment_id: existing.commentId,
        body,
      })

      robotThreads.delete(slug)
    } else {
      newComments.push({
        path: issue.file,
        line: issue.line ?? 1,
        body,
      })
    }
  }

  // Resolve unresolved robot threads whose issues are no longer present.

  for (const [, thread] of robotThreads) {
    await github.graphql(`
      mutation($threadId: ID!) {
        resolveReviewThread(input: { threadId: $threadId }) {
          thread { id }
        }
      }
    `, { threadId: thread.threadId })
  }

  // Post new issue comments as a single review.

  if (newComments.length > 0) {
    await github.rest.pulls.createReview({
      owner,
      repo,
      pull_number: prNumber,
      commit_id: commitSha,
      event: 'COMMENT',
      comments: newComments,
    })
  }
}
