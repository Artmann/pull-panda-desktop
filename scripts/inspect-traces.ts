import fs from 'node:fs'
import path from 'node:path'

import { type Database } from 'sql.js'

import {
  computeStats,
  createQueryFunction,
  getTrace,
  queryTraces,
  spanDepths,
  type QueryFunction
} from '../src/telemetry/queries'
import type { SpanRecord, TraceSummary } from '../src/telemetry/types'
import { bold, cyan, dim, green, loadSqlJs, red, yellow } from './cli-utils'

interface CliOptions {
  errorsOnly: boolean
  json: boolean
  limit: number
  operation: string | null
  search: string | null
  sinceMs: number | null
  slow: boolean
  stats: boolean
  traceId: string | null
}

function usage(): never {
  console.log(`
${bold('Usage:')} bun run inspect-traces [options]

${bold('Options:')}
  --trace <id>     Show the full span waterfall + logs for one trace
  --slow           Sort traces by duration (slowest first)
  --errors         Only traces that contain an error span
  --op <name>      Filter traces whose spans match this operation name
  --since <spec>   Only spans newer than this (e.g. 30s, 15m, 2h)
  --limit <n>      Max number of traces to list (default 30)
  --stats          Print aggregate per-operation timing instead of traces
  --json           Machine-readable JSON output (for agents)

${bold('Examples:')}
  bun run inspect-traces
  bun run inspect-traces --slow --limit 10
  bun run inspect-traces --errors --json
  bun run inspect-traces --op sync.pullRequestDetails
  bun run inspect-traces --trace 1a2b3c... --json
  bun run inspect-traces --since 5m --stats
`)
  process.exit(1)
}

function parseSince(spec: string): number {
  const match = /^(\d+)(s|m|h)$/.exec(spec)

  if (!match) {
    console.error(red(`Error: --since expects a value like 30s, 15m or 2h.`))
    process.exit(1)
  }

  const amount = Number(match[1])
  const unit = match[2]
  const multiplier = unit === 's' ? 1000 : unit === 'm' ? 60000 : 3600000

  return Date.now() - amount * multiplier
}

export function parseArgs(args: string[]): CliOptions {
  const options: CliOptions = {
    errorsOnly: false,
    json: false,
    limit: 30,
    operation: null,
    search: null,
    sinceMs: null,
    slow: false,
    stats: false,
    traceId: null
  }

  for (let index = 0; index < args.length; index++) {
    const argument = args[index]

    if (argument === '--slow') {
      options.slow = true
    } else if (argument === '--errors') {
      options.errorsOnly = true
    } else if (argument === '--json') {
      options.json = true
    } else if (argument === '--stats') {
      options.stats = true
    } else if (argument === '--trace') {
      index++
      options.traceId = requireValue(args[index], '--trace')
    } else if (argument === '--op') {
      index++
      options.search = requireValue(args[index], '--op')
      options.operation = options.search
    } else if (argument === '--since') {
      index++
      options.sinceMs = parseSince(requireValue(args[index], '--since'))
    } else if (argument === '--limit') {
      index++
      options.limit = Number(requireValue(args[index], '--limit'))
    } else {
      console.error(red(`Error: Unknown option "${argument}".`))
      usage()
    }
  }

  return options
}

function requireValue(value: string | undefined, flag: string): string {
  if (!value || value.startsWith('-')) {
    console.error(red(`Error: ${flag} requires a value.`))
    process.exit(1)
  }

  return value
}

function getDatabasePath(): string {
  return path.join(process.cwd(), 'pull-panda-telemetry.db')
}

async function openDatabase(): Promise<Database> {
  const databasePath = getDatabasePath()

  if (!fs.existsSync(databasePath)) {
    console.error(
      red(`Error: Telemetry database not found at ${databasePath}`),
      '\nStart the app with `yarn start` (dev) to generate telemetry first.'
    )
    process.exit(1)
  }

  const SQL = await loadSqlJs()
  const fileBuffer = fs.readFileSync(databasePath)

  return new SQL.Database(fileBuffer)
}

function formatDuration(milliseconds: number | null): string {
  if (milliseconds === null) {
    return dim('—')
  }

  if (milliseconds < 1000) {
    return `${milliseconds}ms`
  }

  return `${(milliseconds / 1000).toFixed(2)}s`
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toISOString().slice(11, 23)
}

function statusColor(status: string, text: string): string {
  if (status === 'error') {
    return red(text)
  }

  if (status === 'ok') {
    return green(text)
  }

  return yellow(text)
}

function printTraceList(traces: TraceSummary[]): void {
  console.log()
  console.log(cyan(bold(`--- Traces (${traces.length}) ---`)))

  if (traces.length === 0) {
    console.log(dim('  (none)'))

    return
  }

  for (const trace of traces) {
    const idShort = trace.traceId.slice(0, 12)
    const status = statusColor(trace.status, trace.status.toUpperCase())
    const errors = trace.errorCount > 0 ? red(` ${trace.errorCount} err`) : ''

    console.log(
      `  ${dim(formatTime(trace.startTime))} ${bold(trace.rootName)} ${dim(idShort)} ` +
        `${formatDuration(trace.durationMs)} ${dim(`${trace.spanCount} spans`)} ${status}${errors}`
    )
  }

  console.log()
  console.log(dim('Run with --trace <id> to see a waterfall.'))
}

function printWaterfall(traceId: string, spans: SpanRecord[]): void {
  console.log()
  console.log(cyan(bold(`--- Trace ${traceId} (${spans.length} spans) ---`)))

  if (spans.length === 0) {
    console.log(dim('  (no spans)'))

    return
  }

  const traceStart = Math.min(...spans.map((span) => span.startTime))
  const depthOf = spanDepths(spans)

  for (const span of spans) {
    const indent = '  '.repeat(depthOf.get(span.spanId) ?? 0)
    const offset = span.startTime - traceStart
    const status = statusColor(span.status, span.status.toUpperCase())

    console.log(
      `  ${dim(`+${offset}ms`.padStart(8))} ${indent}${bold(span.name)} ` +
        `${formatDuration(span.durationMs)} ${dim(`[${span.source}]`)} ${status}`
    )

    if (span.statusMessage) {
      console.log(
        `           ${indent}${red(span.statusMessage.split('\n')[0])}`
      )
    }
  }
}

function renderTraceDetail(query: QueryFunction, options: CliOptions): void {
  const detail = getTrace(query, options.traceId ?? '')

  if (options.json) {
    console.log(JSON.stringify(detail, null, 2))

    return
  }

  printWaterfall(detail.traceId, detail.spans)

  if (detail.logs.length === 0) {
    return
  }

  console.log()
  console.log(cyan(bold(`--- Logs (${detail.logs.length}) ---`)))

  for (const log of detail.logs) {
    const level = log.level === 'error' ? 'error' : 'unset'

    console.log(
      `  ${dim(formatTime(log.timestamp))} ${statusColor(level, log.level)} ${log.message}`
    )
  }
}

function renderStats(query: QueryFunction, options: CliOptions): void {
  const stats = computeStats(query)

  if (options.json) {
    console.log(JSON.stringify(stats, null, 2))

    return
  }

  console.log()
  console.log(
    cyan(bold('--- Stats ---')),
    dim(
      `${stats.traceCount} traces, ${stats.spanCount} spans, ${stats.logCount} logs, ${stats.errorTraceCount} error traces`
    )
  )
  console.log()

  for (const operation of stats.operations) {
    const errors =
      operation.errorCount > 0 ? red(` ${operation.errorCount} err`) : ''

    console.log(
      `  ${bold(operation.name.padEnd(32))} ${dim(`n=${operation.count}`)} ` +
        `p50 ${formatDuration(operation.p50Ms)} p95 ${formatDuration(operation.p95Ms)} max ${formatDuration(operation.maxDurationMs)}${errors}`
    )
  }
}

function renderTraceList(query: QueryFunction, options: CliOptions): void {
  const traces = queryTraces(query, {
    limit: options.limit,
    search: options.search ?? undefined,
    since: options.sinceMs ?? undefined,
    status: options.errorsOnly ? 'error' : 'all'
  })

  const ordered = options.slow
    ? [...traces].sort((first, second) => second.durationMs - first.durationMs)
    : traces

  if (options.json) {
    console.log(JSON.stringify(ordered, null, 2))

    return
  }

  printTraceList(ordered)
}

async function main(): Promise<void> {
  const options = parseArgs(process.argv.slice(2))
  const sqlite = await openDatabase()
  const query = createQueryFunction(sqlite)

  if (options.traceId) {
    renderTraceDetail(query, options)
  } else if (options.stats) {
    renderStats(query, options)
  } else {
    renderTraceList(query, options)
  }

  sqlite.close()
}

if (import.meta.main) {
  main().catch((error) => {
    console.error(red('inspect-traces failed:'), error)
    process.exit(1)
  })
}
