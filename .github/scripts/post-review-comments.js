const fs = require('fs')
const path = require('path')

const summaryMarker = '<!-- robot-code-review -->\n<!-- robot-code-review-summary -->'
const commentMarker = '<!-- robot-code-review -->'

const severityEmoji = {
  critical: '\u{1f6a8}',
  major: '\u26a0\ufe0f',
  minor: '\u{1f4dd}',
}

function fileMarker(filePath) {
  return `<!-- file: ${filePath} -->`
}

function buildSummaryBody(summary, issues) {
  let body = `${summaryMarker}\n\n## Robot Code Review\n\n${summary}\n`

  if (issues.length === 0) {
    body += '\n**No issues found.**\n'

    return body
  }

  body += '\n| File | Severity | Title |\n|------|----------|-------|\n'

  for (const issue of issues) {
    const emoji = severityEmoji[issue.severity] ?? ''
    body += `| \`${issue.file}\` | ${emoji} ${issue.severity} | ${issue.title} |\n`
  }

  return body
}

function buildFileCommentBody(filePath, issues) {
  let body = `${commentMarker}\n${fileMarker(filePath)}\n\n`

  for (const issue of issues) {
    const emoji = severityEmoji[issue.severity] ?? ''
    body += `### ${emoji} ${issue.severity}: ${issue.title}\n\n${issue.description}\n\n`
  }

  return body.trimEnd()
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

    const fileMatch = firstComment.body.match(/<!-- file: (.+?) -->/)

    if (fileMatch) {
      robotThreads.set(fileMatch[1], {
        threadId: thread.id,
        commentId: firstComment.databaseId,
        isResolved: thread.isResolved,
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

  // Handle file comments.

  const issuesByFile = new Map()

  for (const issue of issues) {
    if (!issuesByFile.has(issue.file)) {
      issuesByFile.set(issue.file, [])
    }

    issuesByFile.get(issue.file).push(issue)
  }

  const threads = await fetchExistingReviewThreads(github, owner, repo, prNumber)
  const robotThreads = findRobotThreads(threads)
  const newComments = []

  // Update existing threads or collect new comments.

  for (const [filePath, fileIssues] of issuesByFile) {
    const body = buildFileCommentBody(filePath, fileIssues)
    const existing = robotThreads.get(filePath)

    if (existing) {
      await github.rest.pulls.updateReviewComment({
        owner,
        repo,
        comment_id: existing.commentId,
        body,
      })

      if (existing.isResolved) {
        await github.graphql(`
          mutation($threadId: ID!) {
            unresolveReviewThread(input: { threadId: $threadId }) {
              thread { id }
            }
          }
        `, { threadId: existing.threadId })
      }

      robotThreads.delete(filePath)
    } else {
      const line = fileIssues[0].line ?? 1

      newComments.push({ path: filePath, line, body })
    }
  }

  // Resolve threads for files that no longer have issues.

  for (const [, thread] of robotThreads) {
    if (!thread.isResolved) {
      await github.graphql(`
        mutation($threadId: ID!) {
          resolveReviewThread(input: { threadId: $threadId }) {
            thread { id }
          }
        }
      `, { threadId: thread.threadId })
    }
  }

  // Post new file comments as a single review.

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
