import fs from 'node:fs'
import path from 'node:path'

import { drizzle, type SQLJsDatabase } from 'drizzle-orm/sql-js'
import { and, eq, isNull } from 'drizzle-orm'
import initSqlJs, { type Database } from 'sql.js'

import {
  checks,
  commentReactions,
  comments,
  commits,
  modifiedFiles,
  pullRequests,
  reviews
} from '../src/database/schema'

type PullRequest = typeof pullRequests.$inferSelect

// ANSI colors

const bold = (text: string) => `\x1b[1m${text}\x1b[0m`
const cyan = (text: string) => `\x1b[36m${text}\x1b[0m`
const dim = (text: string) => `\x1b[2m${text}\x1b[0m`
const green = (text: string) => `\x1b[32m${text}\x1b[0m`
const red = (text: string) => `\x1b[31m${text}\x1b[0m`
const yellow = (text: string) => `\x1b[33m${text}\x1b[0m`

// Fields to omit from JSON output (replaced with length placeholder)

const noisyFields = new Set([
  'authorAvatarUrl',
  'bodyHtml',
  'body_html',
  'diffHunk',
  'diff_hunk',
  'userAvatarUrl'
])

function usage(): never {
  console.log(`
${bold('Usage:')} bun run inspect-pr <number> [options]

${bold('Options:')}
  --brief          Only print the main PR record
  --repo owner/name  Filter by repository (when multiple repos have same PR number)

${bold('Examples:')}
  bun run inspect-pr 42
  bun run inspect-pr 42 --brief
  bun run inspect-pr 42 --repo octocat/hello-world
`)
  process.exit(1)
}

function parsePrNumber(argument: string): number {
  const parsed = parseInt(argument, 10)

  if (isNaN(parsed) || parsed <= 0) {
    console.error(red(`Error: "${argument}" is not a valid PR number.`))
    process.exit(1)
  }

  return parsed
}

function parseRepoValue(value: string | undefined): string {
  if (!value || !value.includes('/')) {
    console.error(red('Error: --repo requires a value in owner/name format.'))
    process.exit(1)
  }

  return value
}

export function parseArgs(args: string[]) {
  let brief = false
  let number: number | null = null
  let repo: string | null = null

  for (let i = 0; i < args.length; i++) {
    const argument = args[i]

    if (argument === '--brief') {
      brief = true
    } else if (argument === '--repo') {
      i++
      repo = parseRepoValue(args[i])
    } else if (!argument.startsWith('-')) {
      number = parsePrNumber(argument)
    } else {
      console.error(red(`Error: Unknown option "${argument}".`))
      usage()
    }
  }

  if (number === null) {
    usage()
  }

  return { brief, number, repo }
}

export function formatState(state: string) {
  switch (state.toUpperCase()) {
    case 'MERGED':
      return `\x1b[35m${state}\x1b[0m`
    case 'CLOSED':
      return red(state)
    case 'OPEN':
      return green(state)
    default:
      return yellow(state)
  }
}

export function redactNoisy(key: string, value: unknown): unknown {
  if (noisyFields.has(key) && typeof value === 'string') {
    return `[${value.length} chars]`
  }

  return value
}

function printJson(rows: Record<string, unknown>[]) {
  for (const row of rows) {
    const json = JSON.stringify(row, redactNoisy, 2)
    console.log(dim(json))
  }
}

function printSection(label: string, rows: Record<string, unknown>[]) {
  console.log()
  console.log(cyan(bold(`--- ${label} (${rows.length}) ---`)))

  if (rows.length === 0) {
    console.log(dim('  (none)'))

    return
  }

  printJson(rows)
}

async function openDatabase(): Promise<{
  database: SQLJsDatabase
  sqlite: Database
}> {
  const databasePath = path.join(process.cwd(), 'pull-panda.db')

  if (!fs.existsSync(databasePath)) {
    console.error(
      red(`Error: Database not found at ${databasePath}`),
      '\nMake sure you run this from the project root where pull-panda.db exists.'
    )
    process.exit(1)
  }

  const wasmPath = path.join(
    process.cwd(),
    'node_modules',
    'sql.js',
    'dist',
    'sql-wasm.wasm'
  )
  const wasmBuffer = fs.readFileSync(wasmPath)
  const wasmBinary = wasmBuffer.buffer.slice(
    wasmBuffer.byteOffset,
    wasmBuffer.byteOffset + wasmBuffer.byteLength
  ) as ArrayBuffer

  const SQL = await initSqlJs({ wasmBinary })
  const fileBuffer = fs.readFileSync(databasePath)
  const sqlite = new SQL.Database(fileBuffer)
  const database = drizzle(sqlite)

  return { database, sqlite }
}

export function buildRepoConditions(repo: string | null) {
  if (!repo) {
    return []
  }

  const [owner, name] = repo.split('/')

  return [
    eq(pullRequests.repositoryOwner, owner),
    eq(pullRequests.repositoryName, name)
  ]
}

function findPullRequest(
  database: SQLJsDatabase,
  sqlite: Database,
  number: number,
  repo: string | null
): PullRequest {
  const matchingPrs = database
    .select()
    .from(pullRequests)
    .where(and(eq(pullRequests.number, number), ...buildRepoConditions(repo)))
    .all()

  if (matchingPrs.length === 0) {
    console.error(
      red(`Error: No PR #${number} found in the database.`),
      repo ? `\n  Filtered by repo: ${repo}` : ''
    )
    sqlite.close()
    process.exit(1)
  }

  if (matchingPrs.length > 1 && !repo) {
    console.error(
      red(`Error: Found ${matchingPrs.length} PRs with number #${number}.`),
      '\nUse --repo to disambiguate:\n'
    )

    for (const pr of matchingPrs) {
      console.error(
        `  bun run inspect-pr ${number} --repo ${pr.repositoryOwner}/${pr.repositoryName}`
      )
    }

    sqlite.close()
    process.exit(1)
  }

  return matchingPrs[0]
}

function printSummaryHeader(pr: PullRequest) {
  console.log()
  console.log(bold(`PR #${pr.number}: ${pr.title}`))
  console.log(`  Repo:    ${pr.repositoryOwner}/${pr.repositoryName}`)
  console.log(`  State:   ${formatState(pr.state)}`)
  console.log(`  Author:  ${pr.authorLogin ?? dim('(unknown)')}`)
  console.log(`  URL:     ${pr.url}`)
  console.log(`  Created: ${pr.createdAt}  Updated: ${pr.updatedAt}`)

  if (pr.mergedAt) {
    console.log(`  Merged:  ${pr.mergedAt}`)
  }

  if (pr.closedAt) {
    console.log(`  Closed:  ${pr.closedAt}`)
  }

  console.log(
    `  Synced:  ${pr.syncedAt}  Details: ${pr.detailsSyncedAt ?? dim('(never)')}`
  )
  console.log(
    `  Draft: ${pr.isDraft}  Author: ${pr.isAuthor}  Assignee: ${pr.isAssignee}  Reviewer: ${pr.isReviewer}`
  )
}

function printRelatedSections(
  database: SQLJsDatabase,
  pullRequestId: PullRequest['id']
) {
  const reviewRows = database
    .select()
    .from(reviews)
    .where(
      and(eq(reviews.pullRequestId, pullRequestId), isNull(reviews.deletedAt))
    )
    .all()

  const commentRows = database
    .select()
    .from(comments)
    .where(
      and(eq(comments.pullRequestId, pullRequestId), isNull(comments.deletedAt))
    )
    .all()

  const reactionRows = database
    .select()
    .from(commentReactions)
    .where(
      and(
        eq(commentReactions.pullRequestId, pullRequestId),
        isNull(commentReactions.deletedAt)
      )
    )
    .all()

  const checkRows = database
    .select()
    .from(checks)
    .where(
      and(eq(checks.pullRequestId, pullRequestId), isNull(checks.deletedAt))
    )
    .all()

  const commitRows = database
    .select()
    .from(commits)
    .where(
      and(eq(commits.pullRequestId, pullRequestId), isNull(commits.deletedAt))
    )
    .all()

  const fileRows = database
    .select()
    .from(modifiedFiles)
    .where(
      and(
        eq(modifiedFiles.pullRequestId, pullRequestId),
        isNull(modifiedFiles.deletedAt)
      )
    )
    .all()

  printSection('Reviews', reviewRows)
  printSection('Comments', commentRows)
  printSection('Reactions', reactionRows)
  printSection('Checks', checkRows)
  printSection('Commits', commitRows)
  printSection('Modified Files', fileRows)
}

async function main() {
  const { brief, number, repo } = parseArgs(process.argv.slice(2))
  const { database, sqlite } = await openDatabase()
  const pr = findPullRequest(database, sqlite, number, repo)

  printSummaryHeader(pr)

  if (brief) {
    console.log()
    console.log(cyan(bold('--- PR Record ---')))
    printJson([pr])
    sqlite.close()

    return
  }

  printRelatedSections(database, pr.id)
  sqlite.close()
}

if (import.meta.main) {
  main()
}
