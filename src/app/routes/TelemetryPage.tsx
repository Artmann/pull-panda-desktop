import { useCallback, useEffect, useState, type ReactElement } from 'react'
import { Activity, AlertTriangle, ArrowLeft, Layers, ScrollText } from 'lucide-react'
import { Link } from 'react-router'

import { Badge } from '@/app/components/ui/badge'
import { Button } from '@/app/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle
} from '@/app/components/ui/card'
import { Input } from '@/app/components/ui/input'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/app/components/ui/table'
import {
  formatDuration,
  TraceWaterfall
} from '@/app/components/telemetry/TraceWaterfall'
import type {
  TelemetryStats,
  TraceDetail,
  TraceSummary
} from '@/telemetry/types'

const refreshInterval = 2000

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], { hour12: false })
}

export function TelemetryPage(): ReactElement {
  const [enabled, setEnabled] = useState<boolean | null>(null)
  const [stats, setStats] = useState<TelemetryStats | null>(null)
  const [traces, setTraces] = useState<TraceSummary[]>([])
  const [search, setSearch] = useState('')
  const [errorsOnly, setErrorsOnly] = useState(false)
  const [selected, setSelected] = useState<TraceDetail | null>(null)

  useEffect(() => {
    window.telemetry.isEnabled().then(setEnabled)
  }, [])

  const refresh = useCallback(async () => {
    const [nextStats, nextTraces] = await Promise.all([
      window.telemetry.getStats(),
      window.telemetry.queryTraces({
        limit: 100,
        search: search || undefined,
        status: errorsOnly ? 'error' : 'all'
      })
    ])

    setStats(nextStats)
    setTraces(nextTraces)
  }, [errorsOnly, search])

  useEffect(
    function pollForData() {
      if (enabled === false) {
        return
      }

      refresh()

      const intervalId = setInterval(refresh, refreshInterval)

      return () => clearInterval(intervalId)
    },
    [enabled, refresh]
  )

  const openTrace = useCallback((traceId: string) => {
    window.telemetry.getTrace(traceId).then(setSelected)
  }, [])

  if (enabled === false) {
    return (
      <PageShell>
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Telemetry is disabled in this build. It is only collected in
            development (`!app.isPackaged`).
          </CardContent>
        </Card>
      </PageShell>
    )
  }

  return (
    <PageShell>
      <div className="grid grid-cols-4 gap-4 mb-6">
        <SummaryCard
          icon={<Layers className="h-4 w-4" />}
          label="Traces"
          value={stats?.traceCount ?? 0}
        />
        <SummaryCard
          icon={<AlertTriangle className="h-4 w-4 text-red-500" />}
          label="Error traces"
          value={stats?.errorTraceCount ?? 0}
        />
        <SummaryCard
          icon={<Activity className="h-4 w-4" />}
          label="Spans"
          value={stats?.spanCount ?? 0}
        />
        <SummaryCard
          icon={<ScrollText className="h-4 w-4" />}
          label="Logs"
          value={stats?.logCount ?? 0}
        />
      </div>

      {selected ? (
        <TraceDetailPanel detail={selected} onClose={() => setSelected(null)} />
      ) : null}

      <div className="grid grid-cols-2 gap-6 items-start">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Slowest operations</CardTitle>
            <CardDescription className="text-xs">
              p50 / p95 / max duration per span name
            </CardDescription>
          </CardHeader>
          <CardContent>
            <OperationsTable stats={stats} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Recent traces</CardTitle>
            <CardDescription className="text-xs">
              Click a trace to see its waterfall
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2 mb-3">
              <Input
                placeholder="Filter by operation or trace id..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
              <Button
                type="button"
                variant={errorsOnly ? 'default' : 'outline'}
                size="sm"
                onClick={() => setErrorsOnly((previous) => !previous)}
              >
                Errors
              </Button>
            </div>

            <TraceTable traces={traces} onSelect={openTrace} />
          </CardContent>
        </Card>
      </div>
    </PageShell>
  )
}

function PageShell({ children }: { children: ReactElement | ReactElement[] }) {
  return (
    <div className="w-full max-w-320 mx-auto px-6 py-4">
      <div className="mb-6">
        <Link to="/bg">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mb-4"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </Link>

        <h1 className="text-xl font-bold">Telemetry</h1>
        <p className="text-muted-foreground text-xs">
          Local OTEL-style traces and logs. Nothing leaves this machine.
        </p>
      </div>

      {children}
    </div>
  )
}

interface SummaryCardProps {
  icon: ReactElement
  label: string
  value: number
}

function SummaryCard({ icon, label, value }: SummaryCardProps): ReactElement {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardDescription className="flex items-center gap-2 text-xs">
          {icon}
          {label}
        </CardDescription>
        <CardTitle className="text-lg">{value}</CardTitle>
      </CardHeader>
    </Card>
  )
}

function OperationsTable({
  stats
}: {
  stats: TelemetryStats | null
}): ReactElement {
  const operations = stats?.operations.slice(0, 15) ?? []

  if (operations.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-8">
        No spans recorded yet.
      </div>
    )
  }

  return (
    <Table className="table-fixed text-xs">
      <TableHeader>
        <TableRow>
          <TableHead>Operation</TableHead>
          <TableHead className="w-10 text-right">n</TableHead>
          <TableHead className="w-16 text-right">p50</TableHead>
          <TableHead className="w-16 text-right">p95</TableHead>
          <TableHead className="w-16 text-right">max</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {operations.map((operation) => (
          <TableRow key={operation.name}>
            <TableCell className="font-medium">
              <div className="flex items-center gap-1.5 min-w-0">
                <span
                  className="truncate"
                  title={operation.name}
                >
                  {operation.name}
                </span>
                {operation.errorCount > 0 ? (
                  <Badge
                    variant="destructive"
                    className="shrink-0 px-1 py-0 text-[10px] leading-tight"
                  >
                    {operation.errorCount}
                  </Badge>
                ) : null}
              </div>
            </TableCell>
            <TableCell className="text-right text-muted-foreground">
              {operation.count}
            </TableCell>
            <TableCell className="text-right">
              {formatDuration(operation.p50Ms)}
            </TableCell>
            <TableCell className="text-right">
              {formatDuration(operation.p95Ms)}
            </TableCell>
            <TableCell className="text-right">
              {formatDuration(operation.maxDurationMs)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

interface TraceTableProps {
  onSelect: (traceId: string) => void
  traces: TraceSummary[]
}

function TraceTable({ traces, onSelect }: TraceTableProps): ReactElement {
  if (traces.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-8">
        No traces match. Use the app to generate some.
      </div>
    )
  }

  return (
    <Table className="table-fixed text-xs">
      <TableHeader>
        <TableRow>
          <TableHead>Root</TableHead>
          <TableHead className="w-20 text-right">Duration</TableHead>
          <TableHead className="w-14 text-right">Spans</TableHead>
          <TableHead className="w-20 text-right">Time</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {traces.map((trace) => (
          <TableRow
            key={trace.traceId}
            className="cursor-pointer"
            onClick={() => onSelect(trace.traceId)}
          >
            <TableCell className="font-medium">
              <div className="flex items-center gap-1.5 min-w-0">
                <span
                  className="truncate"
                  title={trace.rootName}
                >
                  {trace.rootName}
                </span>
                {trace.status === 'error' ? (
                  <Badge
                    variant="destructive"
                    className="shrink-0 px-1 py-0 text-[10px] leading-tight"
                  >
                    error
                  </Badge>
                ) : null}
              </div>
            </TableCell>
            <TableCell className="text-right">
              {formatDuration(trace.durationMs)}
            </TableCell>
            <TableCell className="text-right text-muted-foreground">
              {trace.spanCount}
            </TableCell>
            <TableCell className="text-right text-muted-foreground whitespace-nowrap">
              {formatTime(trace.startTime)}
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  )
}

interface TraceDetailPanelProps {
  detail: TraceDetail
  onClose: () => void
}

function TraceDetailPanel({
  detail,
  onClose
}: TraceDetailPanelProps): ReactElement {
  return (
    <Card className="mb-6">
      <CardHeader className="flex flex-row items-start justify-between">
        <div>
          <CardTitle>Trace waterfall</CardTitle>
          <CardDescription className="font-mono text-xs">
            {detail.traceId}
          </CardDescription>
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={onClose}
        >
          Close
        </Button>
      </CardHeader>
      <CardContent className="space-y-6">
        <TraceWaterfall spans={detail.spans} />

        {detail.logs.length > 0 ? (
          <div>
            <h3 className="text-sm font-medium mb-2">
              Logs ({detail.logs.length})
            </h3>
            <div className="space-y-1 font-mono text-xs">
              {detail.logs.map((log) => (
                <div
                  key={log.id}
                  className="flex gap-2"
                >
                  <span className="text-muted-foreground">
                    {formatTime(log.timestamp)}
                  </span>
                  <span
                    className={
                      log.level === 'error' || log.level === 'fatal'
                        ? 'text-red-500'
                        : 'text-muted-foreground'
                    }
                  >
                    {log.level}
                  </span>
                  <span>{log.message}</span>
                </div>
              ))}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  )
}
