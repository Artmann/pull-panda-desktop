import {
  CircleAlertIcon,
  CircleCheckIcon,
  CircleDashedIcon,
  CircleIcon,
  type LucideIcon
} from 'lucide-react'

import type { Check } from '@/types/pull-request-details'

export type CheckRollup = 'failing' | 'none' | 'passing' | 'running'

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
  const running = checks.filter(isCheckRunning).length
  const failed = checks.filter(isCheckFailed).length
  const skipped = checks.filter(
    (check) => check.conclusion?.toLowerCase() === 'skipped'
  ).length
  const successful = checks.filter(
    (check) => check.conclusion?.toLowerCase() === 'success'
  ).length

  const parts: string[] = []

  if (running > 0) {
    parts.push(`${running.toString()} running`)
  }

  if (failed > 0) {
    parts.push(`${failed.toString()} failed`)
  }

  if (skipped > 0) {
    parts.push(`${skipped.toString()} skipped`)
  }

  if (successful > 0) {
    parts.push(`${successful.toString()} successful`)
  }

  if (parts.length === 0) {
    return `${checks.length.toString()} checks`
  }

  return parts.join(', ')
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
