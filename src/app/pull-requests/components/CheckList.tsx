import {
  CircleAlert,
  CircleCheck,
  CircleIcon,
  ExternalLink
} from 'lucide-react'
import { useMemo, type ReactElement } from 'react'

import type { Check } from '@/types/pull-request-details'

import {
  checkRollupColors,
  checkRollupIcons,
  getCheckRollup,
  getCheckRollupLabel,
  getCheckRollupSummary
} from '@/app/components/check-rollup'
import { Link } from '@/app/components/Link'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger
} from '@/app/components/ui/accordion'
import { cn } from '@/app/lib/utils'

const checkConclusionRanks: Record<string, number | undefined> = {
  error: 0,
  failure: 1,
  skipped: 2,
  success: 3
}

const checkStateRanks: Record<string, number | undefined> = {
  completed: 2,
  in_progress: 1,
  queued: 0
}

function compareCheckConclusions(a: Check, b: Check): number | undefined {
  const aConclusion = a.conclusion?.toLowerCase()
  const bConclusion = b.conclusion?.toLowerCase()

  if (!aConclusion || !bConclusion) {
    return
  }

  if (checkConclusionRanks[aConclusion] === checkConclusionRanks[bConclusion]) {
    return
  }

  return (
    (checkConclusionRanks[aConclusion] ?? 3) -
    (checkConclusionRanks[bConclusion] ?? 3)
  )
}

function compareCheckStates(a: Check, b: Check): number | undefined {
  const aState = a.state?.toLowerCase()
  const bState = b.state?.toLowerCase()

  if (!aState || !bState) {
    return
  }

  if (checkStateRanks[aState] === checkStateRanks[bState]) {
    return
  }

  return (checkStateRanks[aState] ?? 2) - (checkStateRanks[bState] ?? 2)
}

export function CheckList({ checks }: { checks: Check[] }): ReactElement {
  const rollup = useMemo(() => getCheckRollup(checks), [checks])

  const isOpenByDefault = rollup === 'failing'

  const icon = useMemo(() => {
    const Icon = checkRollupIcons[rollup]

    return <Icon className={cn('size-6', checkRollupColors[rollup])} />
  }, [rollup])

  const title = getCheckRollupLabel(rollup)
  const subtitle = useMemo(() => getCheckRollupSummary(checks), [checks])

  const sortedChecks = [...checks].sort(
    (a, b) =>
      compareCheckStates(a, b) ??
      compareCheckConclusions(a, b) ??
      a.name.localeCompare(b.name)
  )

  const getCheckIcon = (check: Check) => {
    const state = check.state?.toLowerCase()
    const conclusion = check.conclusion?.toLowerCase()

    if (state === 'queued' || state === 'in_progress') {
      return (
        <CircleIcon className="size-4 text-muted-foreground animate-pulse" />
      )
    }

    switch (conclusion) {
      case 'success':
        return <CircleCheck className="size-4 text-status-success-foreground" />
      case 'failure':
      case 'error':
        return <CircleAlert className="size-4 text-status-danger-foreground" />
      case 'skipped':
        return <CircleIcon className="size-4 text-muted-foreground" />
      default:
        return <CircleIcon className="size-4 text-muted-foreground" />
    }
  }

  const getStatusText = (check: Check) => {
    const state = check.state?.toLowerCase()
    const conclusion = check.conclusion?.toLowerCase()

    if (state === 'queued') {
      return 'Queued'
    }

    if (state === 'in_progress') {
      return 'In progress'
    }

    switch (conclusion) {
      case 'success':
        return 'Passed'
      case 'failure':
        return 'Failed'
      case 'error':
        return 'Error'
      case 'skipped':
        return 'Skipped'
      default:
        return 'Unknown'
    }
  }

  return (
    <div className="w-full">
      <Accordion
        collapsible
        defaultValue={isOpenByDefault ? 'checks' : undefined}
        type="single"
      >
        <AccordionItem value="checks">
          <AccordionTrigger className="p-0">
            <div className="flex items-center gap-2">
              <div>{icon}</div>
              <div>
                <div className="font-semibold text-foreground">{title}</div>
                <div className="text-muted-foreground text-sm">{subtitle}</div>
              </div>
            </div>
          </AccordionTrigger>
          <AccordionContent>
            <div className="space-y-2">
              {sortedChecks.map((check) => {
                return (
                  <div
                    key={check.id}
                    className="flex items-center justify-between py-2 px-2 border-b border-border"
                  >
                    <div className="flex items-center gap-2">
                      {getCheckIcon(check)}
                      <Link
                        className="hover:underline flex items-baseline gap-2 cursor-pointer"
                        href={check.url ?? undefined}
                      >
                        <span className="text-sm font-medium">
                          {check.name}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {getStatusText(check)}
                        </span>
                      </Link>
                    </div>
                    {check.url && (
                      <Link
                        className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                        href={check.url}
                      >
                        <ExternalLink className="size-3" />
                      </Link>
                    )}
                  </div>
                )
              })}
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  )
}
