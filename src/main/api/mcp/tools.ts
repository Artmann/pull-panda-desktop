import { Effect } from 'effect'
import { z } from 'zod'
import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'

import { getAppRuntime } from '../../../sync/runtime'
import { Database } from '../../../sync/services/database'
import { Repository } from '../../services/repository'
import { modifiedFiles } from '../../../database/schema'
import { getFileContents } from '../operations/get-file-contents'
import { listChecks } from '../operations/list-checks'
import { listComments } from '../operations/list-comments'
import { getFileDiff, listFiles } from '../operations/list-files'
import { listReviews } from '../operations/list-reviews'
import { and, eq, isNull } from 'drizzle-orm'

const maxToolOutputLength = 50_000

const pullRequestIdSchema = z
  .string()
  .describe(
    'The opaque Pull Panda pull request id, exactly as given in the chat context.'
  )

interface ToolResult {
  [key: string]: unknown
  content: Array<{ text: string; type: 'text' }>
  isError?: boolean
}

function truncate(text: string): string {
  if (text.length <= maxToolOutputLength) {
    return text
  }

  return `${text.slice(0, maxToolOutputLength)}\n… (truncated)`
}

function textResult(value: unknown): ToolResult {
  const text =
    typeof value === 'string' ? value : JSON.stringify(value, null, 2)

  return { content: [{ text: truncate(text), type: 'text' }] }
}

function errorResult(error: unknown): ToolResult {
  const message = error instanceof Error ? error.message : String(error)

  return {
    content: [{ text: `Error: ${message}`, type: 'text' }],
    isError: true
  }
}

async function runTool(run: () => Promise<unknown>): Promise<ToolResult> {
  try {
    return textResult(await run())
  } catch (error) {
    return errorResult(error)
  }
}

const findPullRequest = (pullRequestId: string) =>
  Effect.gen(function* () {
    const repository = yield* Repository

    return yield* repository.requirePullRequestById(pullRequestId)
  })

const findModifiedFile = (pullRequestId: string, filePath: string) =>
  Effect.gen(function* () {
    const database = yield* Database

    const rows = yield* database.use('mcpFindModifiedFile', (db) =>
      db
        .select()
        .from(modifiedFiles)
        .where(
          and(
            eq(modifiedFiles.pullRequestId, pullRequestId),
            eq(modifiedFiles.filePath, filePath),
            isNull(modifiedFiles.deletedAt)
          )
        )
        .all()
    )

    return rows[0] ?? null
  })

export function registerPullPandaTools(
  server: McpServer,
  getToken: () => string | null
): void {
  server.registerTool(
    'read_pull_request',
    {
      description:
        'Read the pull request: title, description, state, author, branch and repository.',
      inputSchema: { pullRequestId: pullRequestIdSchema }
    },
    ({ pullRequestId }) =>
      runTool(async () => {
        const pullRequest = await getAppRuntime().runPromise(
          findPullRequest(pullRequestId)
        )

        return {
          author: pullRequest.authorLogin,
          body: pullRequest.body,
          createdAt: pullRequest.createdAt,
          headBranch: pullRequest.headRefName,
          id: pullRequest.id,
          isDraft: pullRequest.isDraft,
          number: pullRequest.number,
          repository: `${pullRequest.repositoryOwner}/${pullRequest.repositoryName}`,
          state: pullRequest.state,
          title: pullRequest.title,
          updatedAt: pullRequest.updatedAt,
          url: pullRequest.url
        }
      })
  )

  server.registerTool(
    'list_files',
    {
      description:
        'List the files changed by the pull request with their status and line counts.',
      inputSchema: { pullRequestId: pullRequestIdSchema }
    },
    ({ pullRequestId }) =>
      runTool(() => getAppRuntime().runPromise(listFiles(pullRequestId)))
  )

  server.registerTool(
    'get_file_diff',
    {
      description: 'Get the diff hunk of one changed file in the pull request.',
      inputSchema: {
        filePath: z
          .string()
          .describe('The file path as returned by list_files.'),
        pullRequestId: pullRequestIdSchema
      }
    },
    ({ filePath, pullRequestId }) =>
      runTool(async () => {
        const diff = await getAppRuntime().runPromise(
          getFileDiff(pullRequestId, filePath)
        )

        return diff ?? `No diff found for ${filePath}.`
      })
  )

  server.registerTool(
    'get_file_contents',
    {
      description:
        'Get the full old (base) and new (head) contents of one changed file in the pull request. Requires network access to GitHub.',
      inputSchema: {
        filePath: z
          .string()
          .describe('The file path as returned by list_files.'),
        pullRequestId: pullRequestIdSchema
      }
    },
    ({ filePath, pullRequestId }) =>
      runTool(async () => {
        const token = getToken()

        if (!token) {
          throw new Error('Pull Panda is not signed in to GitHub.')
        }

        const runtime = getAppRuntime()
        const pullRequest = await runtime.runPromise(
          findPullRequest(pullRequestId)
        )
        const file = await runtime.runPromise(
          findModifiedFile(pullRequestId, filePath)
        )

        if (!file) {
          throw new Error(`${filePath} is not part of this pull request.`)
        }

        return getFileContents({
          blobSha: file.blobSha,
          owner: pullRequest.repositoryOwner,
          path: file.filePath,
          previousFilename: file.previousFilename,
          pullNumber: pullRequest.number,
          repo: pullRequest.repositoryName,
          status: file.status,
          token
        })
      })
  )

  server.registerTool(
    'list_comments',
    {
      description:
        'List all comments on the pull request, including inline review comments with their file path and line.',
      inputSchema: { pullRequestId: pullRequestIdSchema }
    },
    ({ pullRequestId }) =>
      runTool(() => getAppRuntime().runPromise(listComments(pullRequestId)))
  )

  server.registerTool(
    'list_reviews',
    {
      description:
        'List the reviews on the pull request with their state (approved, changes requested, …) and body.',
      inputSchema: { pullRequestId: pullRequestIdSchema }
    },
    ({ pullRequestId }) =>
      runTool(() => getAppRuntime().runPromise(listReviews(pullRequestId)))
  )

  server.registerTool(
    'list_checks',
    {
      description:
        'List the CI checks for the pull request with their state and conclusion.',
      inputSchema: { pullRequestId: pullRequestIdSchema }
    },
    ({ pullRequestId }) =>
      runTool(() => getAppRuntime().runPromise(listChecks(pullRequestId)))
  )
}
