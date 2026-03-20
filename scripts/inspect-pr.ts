import fs from 'node:fs'
import path from 'node:path'

import { drizzle } from 'drizzle-orm/sql-js'
import { and, eq, isNull } from 'drizzle-orm'
import initSqlJs from 'sql.js'

import {
  checks,
  commentReactions,
  comments,
  commits,
  modifiedFiles,
  pullRequests,
  reviews
} from '../src/database/schema'

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

function usage() {
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

function parseArgs() {
  const args = process.argv.slice(2)
  let brief = false
  let number: number | null = null
  let repo: string | null = null

  for (let i = 0; i < args.length; i++) {
    const arg = args[i]

    if (arg === '--brief') {
      brief = true
    } else if (arg === '--repo') {
      i++
      repo = args[i] ?? null

      if (!repo || !repo.includes('/')) {
        console.error(
          red('Error: --repo requires a value in owner/name format.')
        )
        process.exit(1)
      }
    } else if (!arg.startsWith('-')) {
      const parsed = parseInt(arg, 10)

      if (isNaN(parsed) || parsed <= 0) {
        console.error(red(`Error: "${arg}" is not a valid PR number.`))
        process.exit(1)
      }

      number = parsed
    } else {
      console.error(red(`Error: Unknown option "${arg}".`))
      usage()
    }
  }

  if (number === null) {
    usage()
  }

  return { brief, number, repo }
}

function formatState(state: string) {
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

function redactNoisy(key: string, value: unknown): unknown {
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

async function main() {
  const { brief, number, repo } = parseArgs()

  // Open database

  const databasePath = path.join(process.cwd(), 'snappr.db')

  if (!fs.existsSync(databasePath)) {
    console.error(
      red(`Error: Database not found at ${databasePath}`),
      '\nMake sure you run this from the project root where snappr.db exists.'
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

  // Find PR(s) by number

  const numberCondition = eq(pullRequests.number, number)

  const repoConditions = repo
    ? (() => {
        const [owner, name] = repo.split('/')

        return [
          eq(pullRequests.repositoryOwner, owner),
          eq(pullRequests.repositoryName, name)
        ]
      })()
    : []

  const matchingPrs = database
    .select()
    .from(pullRequests)
    .where(and(numberCondition, ...repoConditions))
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

  const pr = matchingPrs[0]

  // Print summary header

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

  if (brief) {
    console.log()
    console.log(cyan(bold('--- PR Record ---')))
    printJson([pr])
    sqlite.close()

    return
  }

  // Query related data

  const reviewRows = database
    .select()
    .from(reviews)
    .where(and(eq(reviews.pullRequestId, pr.id), isNull(reviews.deletedAt)))
    .all()

  const commentRows = database
    .select()
    .from(comments)
    .where(and(eq(comments.pullRequestId, pr.id), isNull(comments.deletedAt)))
    .all()

  const reactionRows = database
    .select()
    .from(commentReactions)
    .where(
      and(
        eq(commentReactions.pullRequestId, pr.id),
        isNull(commentReactions.deletedAt)
      )
    )
    .all()

  const checkRows = database
    .select()
    .from(checks)
    .where(and(eq(checks.pullRequestId, pr.id), isNull(checks.deletedAt)))
    .all()

  const commitRows = database
    .select()
    .from(commits)
    .where(and(eq(commits.pullRequestId, pr.id), isNull(commits.deletedAt)))
    .all()

  const fileRows = database
    .select()
    .from(modifiedFiles)
    .where(
      and(
        eq(modifiedFiles.pullRequestId, pr.id),
        isNull(modifiedFiles.deletedAt)
      )
    )
    .all()

  // Print sections

  printSection('Reviews', reviewRows)
  printSection('Comments', commentRows)
  printSection('Reactions', reactionRows)
  printSection('Checks', checkRows)
  printSection('Commits', commitRows)
  printSection('Modified Files', fileRows)

  sqlite.close()
}

main()
