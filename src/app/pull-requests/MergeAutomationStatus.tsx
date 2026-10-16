import { Clock, ListOrdered } from 'lucide-react'
import type { ReactElement, ReactNode } from 'react'

import { Button } from '@/app/components/ui/button'
import type {
  AutoMergeRequest,
  MergeMethod,
  MergeQueueEntry,
  MergeQueueEntryState
} from '@/types/merge-requirements'

const mergeMethodPhrases: Record<MergeMethod, string> = {
  merge: 'a merge commit',
  rebase: 'rebase and merge',
  squash: 'squash and merge'
}

const queueStateDescriptions: Record<MergeQueueEntryState, string> = {
  AWAITING_CHECKS: 'The queue is running checks on this pull request.',
  LOCKED: 'The queue is merging this pull request.',
  MERGEABLE: 'Checks passed. It will be merged soon.',
  QUEUED: 'Waiting for its turn.',
  UNMERGEABLE: 'It cannot be merged and will be removed from the queue.'
}

function formatEstimatedTimeToMerge(seconds: number): string {
  const minutes = Math.max(1, Math.round(seconds / 60))

  if (minutes < 60) {
    return `About ${minutes.toString()} ${minutes === 1 ? 'minute' : 'minutes'} until it merges.`
  }

  const hours = Math.round(minutes / 60)

  return `About ${hours.toString()} ${hours === 1 ? 'hour' : 'hours'} until it merges.`
}

interface AutoMergeStatusProps {
  autoMergeRequest: AutoMergeRequest
  canDisable: boolean
  isMergeQueueEnabled: boolean
  onDisable: () => void
}

/** Shown in place of the merge button while auto-merge is on. */
export function AutoMergeStatus({
  autoMergeRequest,
  canDisable,
  isMergeQueueEnabled,
  onDisable
}: AutoMergeStatusProps): ReactElement {
  const method = autoMergeRequest.mergeMethod
  const enabledBy = autoMergeRequest.enabledByLogin

  const description = isMergeQueueEnabled
    ? 'It will be added to the merge queue once all requirements are met.'
    : `It will be merged${method ? ` with ${mergeMethodPhrases[method]}` : ''} once all requirements are met.`

  return (
    <StatusCard
      action={
        canDisable && (
          <Button
            className="w-full"
            onClick={onDisable}
            size="sm"
            variant="outline"
          >
            {isMergeQueueEnabled
              ? 'Cancel merge when ready'
              : 'Disable auto-merge'}
          </Button>
        )
      }
      description={
        enabledBy ? `${description} Enabled by ${enabledBy}.` : description
      }
      icon={<Clock className="size-4 text-muted-foreground shrink-0 mt-0.5" />}
      title={isMergeQueueEnabled ? 'Merge when ready' : 'Auto-merge enabled'}
    />
  )
}

interface MergeQueueStatusProps {
  entry: MergeQueueEntry
  onRemove: () => void
}

/** Shown in place of the merge button while the pull request is queued. */
export function MergeQueueStatus({
  entry,
  onRemove
}: MergeQueueStatusProps): ReactElement {
  const estimate =
    entry.estimatedTimeToMerge === null
      ? ''
      : ` ${formatEstimatedTimeToMerge(entry.estimatedTimeToMerge)}`

  return (
    <StatusCard
      action={
        <Button
          className="w-full"
          onClick={onRemove}
          size="sm"
          variant="outline"
        >
          Remove from merge queue
        </Button>
      }
      description={`${queueStateDescriptions[entry.state]}${estimate}`}
      icon={
        <ListOrdered className="size-4 text-muted-foreground shrink-0 mt-0.5" />
      }
      title={
        entry.position === null
          ? 'In the merge queue'
          : `#${entry.position.toString()} in the merge queue`
      }
    />
  )
}

interface StatusCardProps {
  action: ReactNode
  description: string
  icon: ReactElement
  title: string
}

function StatusCard({
  action,
  description,
  icon,
  title
}: StatusCardProps): ReactElement {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start gap-3 border border-border rounded-lg px-3 py-2.5 text-sm">
        {icon}

        <div className="flex flex-col gap-0.5 min-w-0">
          <span className="font-medium">{title}</span>

          <span className="text-xs text-muted-foreground">{description}</span>
        </div>
      </div>

      {action}
    </div>
  )
}
