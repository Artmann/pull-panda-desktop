import {
  CircleAlert,
  CircleAlertIcon,
  CircleCheck,
  CircleCheckIcon,
  CircleIcon,
  ExternalLink
} from 'lucide-react'
import { useMemo, type ReactElement } from 'react'

import type { Check } from '@/types/pull-request-details'

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger
} from '@/app/components/ui/accordion'

export function CheckList({ checks }: { checks: Check[] }): ReactElement {
  const hasRunningChecks = checks.some(
    (check) =>
      check.state?.toLowerCase() === 'in_progress' ||
      check.state?.toLowerCase() === 'queued'
  )
  const hasFailedChecks = checks.some(
    (check) =>
      check.conclusion?.toLowerCase() === 'failure' ||
      check.conclusion?.toLowerCase() === 'error'
  )
  const allChecksPassed = !hasFailedChecks && checks.length > 0
  const isOpenByDefault = hasFailedChecks

  const icon = useMemo(() => {
    if (allChecksPassed) {
      return <CircleCheckIcon className="size-6 text-green-500" />
    }

    if (hasFailedChecks) {
      return <CircleAlertIcon className="size-6 text-red-500" />
    }

    return <CircleIcon className="size-6 text-gray-500" />
  }, [allChecksPassed, hasFailedChecks])

  const title = useMemo(() => {
    if (allChecksPassed) {
      return 'All checks have passed'
    }

    if (hasFailedChecks) {
      return 'Some checks have failed'
    }

    if (hasRunningChecks) {
      return 'Checks are running'
    }

    return 'No checks available'
  }, [allChecksPassed, hasFailedChecks, hasRunningChecks])

  const subtitle = useMemo(() => {
    const numberOfRunningChecks = checks.filter(
      (check) =>
        check.state?.toLowerCase() === 'in_progress' ||
        check.state?.toLowerCase() === 'queued'
    ).length
    const numberOfFailedChecks = checks.filter(
      (check) =>
        check.conclusion?.toLowerCase() === 'failure' ||
        check.conclusion?.toLowerCase() === 'error'
    ).length
    const numberOfSuccessfulChecks = checks.filter(
      (check) => check.conclusion?.toLowerCase() === 'success'
    ).length
    const numberOfSkippedChecks = checks.filter(
      (check) => check.conclusion?.toLowerCase() === 'skipped'
    ).length

    const parts = []

    if (numberOfRunningChecks > 0) {
      parts.push(`${numberOfRunningChecks.toString()} running`)
    }

    if (numberOfFailedChecks > 0) {
      parts.push(`${numberOfFailedChecks.toString()} failed`)
    }

    if (numberOfSkippedChecks > 0) {
      parts.push(`${numberOfSkippedChecks.toString()} skipped`)
    }

    if (numberOfSuccessfulChecks > 0) {
      parts.push(`${numberOfSuccessfulChecks.toString()} successful`)
    }

    if (parts.length === 0) {
      return `${checks.length.toString()} checks`
    }

    return parts.join(', ')
  }, [checks])

  const sortedChecks = [...checks].sort((a, b) => {
    const stateOrder: Record<string, number> = {
      queued: 0,
      in_progress: 1,
      completed: 2
    }
    const conclusionOrder: Record<string, number> = {
      error: 0,
      failure: 1,
      skipped: 2,
      success: 3
    }

    const aState = a.state?.toLowerCase()
    const bState = b.state?.toLowerCase()
    const aConclusion = a.conclusion?.toLowerCase()
    const bConclusion = b.conclusion?.toLowerCase()

    if (aState && bState && stateOrder[aState] !== stateOrder[bState]) {
      return (stateOrder[aState] ?? 2) - (stateOrder[bState] ?? 2)
    }

    if (
      aConclusion &&
      bConclusion &&
      conclusionOrder[aConclusion] !== conclusionOrder[bConclusion]
    ) {
      return (
        (conclusionOrder[aConclusion] ?? 3) -
        (conclusionOrder[bConclusion] ?? 3)
      )
    }

    return a.name.localeCompare(b.name)
  })

  const getCheckIcon = (check: Check) => {
    const state = check.state?.toLowerCase()
    const conclusion = check.conclusion?.toLowerCase()

    if (state === 'queued' || state === 'in_progress') {
      return <CircleIcon className="size-4 text-gray-500 animate-pulse" />
    }

    switch (conclusion) {
      case 'success':
        return <CircleCheck className="size-4 text-green-500" />
      case 'failure':
      case 'error':
        return <CircleAlert className="size-4 text-red-500" />
      case 'skipped':
        return <CircleIcon className="size-4 text-gray-400" />
      default:
        return <CircleIcon className="size-4 text-gray-500" />
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
                      <a
                        className="hover:underline flex items-baseline gap-2 cursor-pointer"
                        href={check.url ?? undefined}
                        onClick={(event) => {
                          if (check.url) {
                            event.preventDefault()
                            window.electron.openUrl(check.url)
                          }
                        }}
                        rel="noopener noreferrer"
                        target="_blank"
                      >
                        <span className="text-sm font-medium">
                          {check.name}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {getStatusText(check)}
                        </span>
                      </a>
                    </div>
                    {check.url && (
                      <a
                        className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                        href={check.url}
                        onClick={(event) => {
                          event.preventDefault()
                          window.electron.openUrl(check.url!)
                        }}
                        rel="noopener noreferrer"
                        target="_blank"
                      >
                        <ExternalLink className="size-3" />
                      </a>
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
