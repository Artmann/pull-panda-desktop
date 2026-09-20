import {
  CircleAlertIcon,
  CircleCheckIcon,
  CircleDashedIcon,
  CircleIcon,
  type LucideIcon
} from 'lucide-react'

import type { Check } from '@/types/pull-request-details'

export type CheckRollup = 'failing' | 'none' | 'passing' | 'running'

export interface CheckTally {
  failed: number
  /**
   * Succeeded or skipped — everything `getCheckRollup` reads as good news. A
   * ratio built from this agrees with the colour beside it: a suite with one
   * skipped check still rolls up to passing, so it must not read "7/8".
   */
  passing: number
  running: number
  skipped: number
  successful: number
  total: number
}

const failedConclusions = new Set(['error', 'failure'])
const runningStates = new Set(['in_progress', 'queued'])

function isCheckFailed(check: Check): boolean {
  return failedConclusions.has(check.conclusion?.toLowerCase() ?? '')
}

function isCheckRunning(check: Check): boolean {
  return runningStates.has(check.state?.toLowerCase() ?? '')
}

export function getCheckRollup(checks: readonly Check[]): CheckRollup {
  if (checks.length === 0) {
    return 'none'
  }

  if (checks.some(isCheckFailed)) {
    return 'failing'
  }

  if (checks.some(isCheckRunning)) {
    return 'running'
  }

  return 'passing'
}

export function getCheckRollupLabel(rollup: CheckRollup): string {
  const labels: Record<CheckRollup, string> = {
    failing: 'Some checks have failed',
    none: 'No checks available',
    passing: 'All checks have passed',
    running: 'Checks are running'
  }

  return labels[rollup]
}

export function getCheckRollupSummary(checks: readonly Check[]): string {
  const tally = getCheckTally(checks)
  const parts: string[] = []

  if (tally.running > 0) {
    parts.push(`${tally.running.toString()} running`)
  }

  if (tally.failed > 0) {
    parts.push(`${tally.failed.toString()} failed`)
  }

  if (tally.skipped > 0) {
    parts.push(`${tally.skipped.toString()} skipped`)
  }

  if (tally.successful > 0) {
    parts.push(`${tally.successful.toString()} successful`)
  }

  if (parts.length === 0) {
    return `${tally.total.toString()} checks`
  }

  return parts.join(', ')
}

export function getCheckTally(checks: readonly Check[]): CheckTally {
  const hasConclusion = (check: Check, conclusion: string): boolean =>
    check.conclusion?.toLowerCase() === conclusion

  const skipped = checks.filter((check) =>
    hasConclusion(check, 'skipped')
  ).length
  const successful = checks.filter((check) =>
    hasConclusion(check, 'success')
  ).length

  return {
    failed: checks.filter(isCheckFailed).length,
    passing: skipped + successful,
    running: checks.filter(isCheckRunning).length,
    skipped,
    successful,
    total: checks.length
  }
}

export const checkRollupColors: Record<CheckRollup, string> = {
  failing: 'text-status-danger-foreground',
  none: 'text-muted-foreground',
  passing: 'text-status-success-foreground',
  running: 'text-status-warning-foreground'
}

export const checkRollupIcons: Record<CheckRollup, LucideIcon> = {
  failing: CircleAlertIcon,
  none: CircleIcon,
  passing: CircleCheckIcon,
  running: CircleDashedIcon
}
