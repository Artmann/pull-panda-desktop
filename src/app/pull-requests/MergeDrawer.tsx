import { Loader2, X } from 'lucide-react'
import { memo, ReactElement, useEffect, useMemo, useState } from 'react'
import { shallowEqual } from 'react-redux'

import { getLatestChecks } from '@/app/components/check-rollup'
import { StatusCircle } from '@/app/components/StatusCircle'
import { Button } from '@/app/components/ui/button'
import { Input } from '@/app/components/ui/input'
import {
  SidePanel,
  SidePanelContent,
  SidePanelFooter,
  SidePanelHeader,
  SidePanelTitle
} from '@/app/components/ui/side-panel'
import { Textarea } from '@/app/components/ui/textarea'
import { mergePullRequest } from '@/app/lib/api'
import type { MergeOptions } from '@/app/lib/api'
import { runOptimisticMutation } from '@/app/lib/mutations/run-optimistic-mutation'
import { cn } from '@/app/lib/utils'
import { BranchSyncActions } from '@/app/pull-requests/components/BranchSyncActions'
import { canMergeNow } from '@/app/pull-requests/merge-button-label'
import { useAppDispatch, useAppSelector } from '@/app/store/hooks'
import { pullRequestsActions } from '@/app/store/pull-requests-slice'
import type { PullRequest } from '@/types/pull-request'

import { getMergeVerdict, type MergeVerdict } from './merge-verdict'
import { buildStatusSummary, type StatusTone } from './status-summary'
import {
  getStatusCircleState,
  statusLabels,
  TaskActionButton
} from './tasks/TaskRow'
import type { TaskGroup } from './tasks/task-types'
import { useDerivedTaskGroups } from './tasks/use-derived-tasks'

type MergeMethod = 'merge' | 'rebase' | 'squash'

const mergeMethodStorageKey = 'pull-panda-merge-method'

function getSavedMergeMethod(repo: string): MergeMethod | null {
  const stored = localStorage.getItem(mergeMethodStorageKey)

  if (!stored) {
    return null
  }

  try {
    const map = JSON.parse(stored) as Record<string, string>

    const method = map[repo]

    if (method === 'merge' || method === 'rebase' || method === 'squash') {
      return method
    }

    return null
  } catch {
    return null
  }
}

function saveMergeMethod(repo: string, method: MergeMethod): void {
  let map: Record<string, string> = {}
  const stored = localStorage.getItem(mergeMethodStorageKey)

  if (stored) {
    try {
      map = JSON.parse(stored) as Record<string, string>
    } catch {
      // Ignore corrupt data.
    }
  }

  map[repo] = method
  localStorage.setItem(mergeMethodStorageKey, JSON.stringify(map))
}

const mergeMethodLabels: Record<MergeMethod, string> = {
  merge: 'Create a merge commit',
  rebase: 'Rebase and merge',
  squash: 'Squash and merge'
}

const mergeMethodShortLabels: Record<MergeMethod, string> = {
  merge: 'Merge',
  rebase: 'Rebase',
  squash: 'Squash'
}

function describeMergeMethod(
  method: MergeMethod,
  commits: string,
  baseName: string
): string {
  const descriptions: Record<MergeMethod, string> = {
    merge: `Adds ${commits} to ${baseName} with a merge commit.`,
    rebase: `Replays ${commits} on top of ${baseName}.`,
    squash: `Combines ${commits} into one on ${baseName}.`
  }

  return descriptions[method]
}

export function getAllowedMergeMethods(
  mergeOptions: MergeOptions | null
): MergeMethod[] {
  if (!mergeOptions) {
    return []
  }

  const methods: MergeMethod[] = []

  if (mergeOptions.allowSquashMerge) {
    methods.push('squash')
  }

  if (mergeOptions.allowMergeCommit) {
    methods.push('merge')
  }

  if (mergeOptions.allowRebaseMerge) {
    methods.push('rebase')
  }

  return methods
}

export function resolveInitialMergeMethod(
  mergeOptions: MergeOptions | null,
  savedMethod: MergeMethod | null
): MergeMethod | null {
  if (!mergeOptions || mergeOptions.mergeable === null) {
    return null
  }

  const allowedMethods = getAllowedMergeMethods(mergeOptions)

  if (savedMethod && allowedMethods.includes(savedMethod)) {
    return savedMethod
  }

  return allowedMethods[0] ?? null
}

interface MergeDrawerProps {
  onClose: () => void
  open: boolean
  pullRequest: PullRequest
}

/**
 * Everything needed to merge in one column beside the pull request: whether
 * it can merge and what is in the way, how to merge, and the button. The
 * page reflows to make room rather than sitting under it.
 */
export const MergeDrawer = memo(function MergeDrawer({
  onClose,
  open,
  pullRequest
}: MergeDrawerProps): ReactElement {
  const mergeOptions = useAppSelector(
    (state) => state.mergeOptions[pullRequest.id] ?? null
  )

  const commitCount = useAppSelector(
    (state) =>
      state.commits.items.filter(
        (commit) => commit.pullRequestId === pullRequest.id
      ).length
  )

  const taskGroups = useDerivedTaskGroups(pullRequest)
  const verdict = useMergeVerdict(pullRequest, mergeOptions, taskGroups)
  const settings = useMergeSettings(pullRequest, mergeOptions)
  const executeMerge = useExecuteMerge(pullRequest, onClose)

  const baseName = pullRequest.baseRefName ?? 'the base branch'
  const commits =
    commitCount === 1 ? '1 commit' : `${commitCount.toString()} commits`

  return (
    <SidePanel
      className="w-90 bg-sidebar"
      open={open}
    >
      <MergeDrawerHeader
        onClose={onClose}
        verdict={verdict}
      />

      <SidePanelContent className="flex flex-col gap-3.5 px-4 py-3.5">
        {mergeOptions ? (
          <>
            {taskGroups.map((group) => (
              <MergeChecklistGroup
                group={group}
                key={group.key}
                pullRequest={pullRequest}
              />
            ))}

            <BranchSyncActions pullRequest={pullRequest} />

            <MergeSettingsFields
              allowedMethods={getAllowedMergeMethods(mergeOptions)}
              baseName={baseName}
              commits={commits}
              settings={settings}
            />
          </>
        ) : (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Loading merge options...
          </div>
        )}
      </SidePanelContent>

      <SidePanelFooter className="border-t border-border px-4 pt-3 pb-3.5">
        <MergeDrawerFooter
          baseName={baseName}
          canMerge={canMergeNow(mergeOptions)}
          commits={commits}
          mergeOptions={mergeOptions}
          onMerge={() => executeMerge(settings)}
          selectedMethod={settings.method}
          verdict={verdict}
        />
      </SidePanelFooter>
    </SidePanel>
  )
})

function useMergeVerdict(
  pullRequest: PullRequest,
  mergeOptions: MergeOptions | null,
  taskGroups: TaskGroup[]
): MergeVerdict {
  const checks = useAppSelector(
    (state) =>
      state.checks.items.filter(
        (check) => check.pullRequestId === pullRequest.id
      ),
    shallowEqual
  )

  const baseName = pullRequest.baseRefName ?? 'the base branch'

  return useMemo(
    () =>
      getMergeVerdict({
        mergeOptions,
        summary: buildStatusSummary({
          baseName,
          checks: getLatestChecks(checks),
          taskGroups
        }),
        taskGroups
      }),
    [baseName, checks, mergeOptions, taskGroups]
  )
}

interface MergeSettings {
  commitMessage: string
  commitTitle: string
  deleteBranch: boolean
  method: MergeMethod | null
  setCommitMessage: (value: string) => void
  setCommitTitle: (value: string) => void
  setDeleteBranch: (value: boolean) => void
  setMethod: (method: MergeMethod) => void
}

/**
 * The choices made in the drawer. The commit message stays null until edited,
 * so it follows the pull request's title and body until then.
 */
function useMergeSettings(
  pullRequest: PullRequest,
  mergeOptions: MergeOptions | null
): MergeSettings {
  const [commitMessage, setCommitMessage] = useState<string | null>(null)
  const [commitTitle, setCommitTitle] = useState<string | null>(null)
  const [deleteBranch, setDeleteBranch] = useState(true)
  const [method, setMethod] = useState<MergeMethod | null>(null)

  useEffect(
    function initializeSelectedMethod() {
      const repo = `${pullRequest.repositoryOwner}/${pullRequest.repositoryName}`

      setMethod(
        resolveInitialMergeMethod(mergeOptions, getSavedMergeMethod(repo))
      )
    },
    [mergeOptions, pullRequest.repositoryName, pullRequest.repositoryOwner]
  )

  return {
    commitMessage: commitMessage ?? pullRequest.body ?? '',
    commitTitle: commitTitle ?? `${pullRequest.title} (#${pullRequest.number})`,
    deleteBranch,
    method,
    setCommitMessage,
    setCommitTitle,
    setDeleteBranch,
    setMethod
  }
}

function useExecuteMerge(
  pullRequest: PullRequest,
  onClose: () => void
): (settings: MergeSettings) => void {
  const dispatch = useAppDispatch()

  return ({ commitMessage, commitTitle, deleteBranch, method }) => {
    if (!method) {
      return
    }

    saveMergeMethod(
      `${pullRequest.repositoryOwner}/${pullRequest.repositoryName}`,
      method
    )

    runOptimisticMutation({
      optimistic: () => {
        dispatch(
          pullRequestsActions.upsertItem({
            ...pullRequest,
            mergedAt: new Date().toISOString(),
            state: 'MERGED'
          })
        )

        onClose()
      },
      request: () =>
        mergePullRequest({
          ...(method === 'squash' && { commitMessage, commitTitle }),
          deleteBranch,
          mergeMethod: method,
          owner: pullRequest.repositoryOwner,
          pullNumber: pullRequest.number,
          pullRequestId: pullRequest.id,
          repo: pullRequest.repositoryName
        }),
      commit: (updated) => dispatch(pullRequestsActions.upsertItem(updated)),
      rollback: () => dispatch(pullRequestsActions.upsertItem(pullRequest)),
      errorMessage: 'Failed to merge pull request'
    })
  }
}

function MergeSettingsFields({
  allowedMethods,
  baseName,
  commits,
  settings
}: {
  allowedMethods: MergeMethod[]
  baseName: string
  commits: string
  settings: MergeSettings
}): ReactElement {
  const { method } = settings

  return (
    <div className="flex flex-col gap-3 border-t border-border pt-3.5">
      {allowedMethods.length > 0 && method && (
        <MergeMethodPicker
          allowedMethods={allowedMethods}
          description={describeMergeMethod(method, commits, baseName)}
          onSelect={settings.setMethod}
          selectedMethod={method}
        />
      )}

      {method === 'squash' && (
        <CommitMessageFields
          commitMessage={settings.commitMessage}
          commitTitle={settings.commitTitle}
          onCommitMessageChange={settings.setCommitMessage}
          onCommitTitleChange={settings.setCommitTitle}
        />
      )}

      <label className="flex cursor-pointer items-center gap-2 text-xs text-foreground/85 select-none">
        <input
          checked={settings.deleteBranch}
          className="size-3.5 accent-primary"
          onChange={(event) => settings.setDeleteBranch(event.target.checked)}
          type="checkbox"
        />
        Delete branch after merge
      </label>
    </div>
  )
}

const verdictDotClassNames: Record<StatusTone, string> = {
  danger: 'bg-status-danger-foreground',
  neutral: 'bg-muted-foreground',
  success: 'bg-status-success-foreground',
  warning: 'bg-status-warning-foreground'
}

const verdictTextClassNames: Record<StatusTone, string> = {
  danger: 'text-status-danger-foreground',
  neutral: 'text-foreground',
  success: 'text-status-success-foreground',
  warning: 'text-status-warning-foreground'
}

function MergeDrawerHeader({
  onClose,
  verdict
}: {
  onClose: () => void
  verdict: MergeVerdict
}): ReactElement {
  return (
    <SidePanelHeader className="flex-row items-start gap-2.5 border-b border-border px-4 pt-3.5 pb-3">
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <SidePanelTitle className="text-sm">Merge</SidePanelTitle>

        <p className="flex items-baseline gap-2 text-xs leading-snug text-foreground/75">
          <span
            aria-hidden
            className={cn(
              'size-1.75 shrink-0 -translate-y-px rounded-full',
              verdictDotClassNames[verdict.tone]
            )}
          />
          <span>
            <span
              className={cn(
                'font-semibold',
                verdictTextClassNames[verdict.tone]
              )}
            >
              {verdict.title}
            </span>{' '}
            · {verdict.detail}
          </span>
        </p>
      </div>

      <Button
        aria-label="Close"
        onClick={onClose}
        size="icon-xs"
        variant="ghost"
      >
        <X className="size-4" />
      </Button>
    </SidePanelHeader>
  )
}

const groupCountClassNames: Record<StatusTone, string> = {
  danger: 'text-status-danger-foreground',
  neutral: 'text-muted-foreground',
  success: 'text-status-success-foreground',
  warning: 'text-status-warning-foreground'
}

function getGroupTone(group: TaskGroup): StatusTone {
  if (group.tasks.some((task) => task.severity === 'blocker')) {
    return 'danger'
  }

  if (group.tasks.some((task) => task.severity !== 'done')) {
    return 'warning'
  }

  return 'success'
}

function MergeChecklistGroup({
  group,
  pullRequest
}: {
  group: TaskGroup
  pullRequest: PullRequest
}): ReactElement {
  const doneCount = group.tasks.filter(
    (task) => task.severity === 'done'
  ).length

  return (
    <section
      aria-label={group.label}
      className="flex flex-col"
    >
      <div className="flex items-center justify-between px-0.5 pb-1.5 text-2xs font-semibold tracking-wider text-muted-foreground uppercase">
        <h3>{group.label}</h3>

        <span
          className={cn(
            'tabular-nums',
            groupCountClassNames[getGroupTone(group)]
          )}
        >
          {doneCount}/{group.tasks.length}
        </span>
      </div>

      <div className="rounded-lg border border-border bg-card">
        {group.tasks.map((task) => {
          const state = getStatusCircleState(task)

          return (
            <div
              className="flex items-center gap-2.5 border-t border-border px-2.5 py-2 first:border-t-0"
              key={task.id}
            >
              <StatusCircle
                className="size-4"
                label={statusLabels[state]}
                state={state}
              />

              <div className="min-w-0 flex-1">
                <div
                  className={cn(
                    'truncate text-xs font-medium',
                    task.severity === 'done'
                      ? 'text-foreground/75'
                      : 'text-foreground'
                  )}
                  title={task.title}
                >
                  {task.title}
                </div>

                {task.meta && (
                  <div className="truncate text-2xs text-muted-foreground">
                    {task.meta}
                  </div>
                )}
              </div>

              {task.action && (
                <TaskActionButton
                  action={task.action}
                  pullRequest={pullRequest}
                  task={task}
                />
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}

const orderedMethods: MergeMethod[] = ['squash', 'merge', 'rebase']

function MergeMethodPicker({
  allowedMethods,
  description,
  onSelect,
  selectedMethod
}: {
  allowedMethods: MergeMethod[]
  description: string
  onSelect: (method: MergeMethod) => void
  selectedMethod: MergeMethod
}): ReactElement {
  const methods = orderedMethods.filter((method) =>
    allowedMethods.includes(method)
  )

  return (
    <div className="flex flex-col gap-1.5">
      <SectionLabel>Method</SectionLabel>

      <div
        className="grid gap-0.5 rounded-md border border-border bg-card p-0.5"
        role="radiogroup"
        style={{
          gridTemplateColumns: `repeat(${methods.length.toString()}, 1fr)`
        }}
      >
        {methods.map((method) => (
          <button
            aria-checked={selectedMethod === method}
            className={cn(
              'h-6.5 cursor-pointer rounded text-xs transition-colors',
              selectedMethod === method
                ? 'bg-muted text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            )}
            key={method}
            onClick={() => onSelect(method)}
            role="radio"
            type="button"
          >
            {mergeMethodShortLabels[method]}
          </button>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">{description}</p>
    </div>
  )
}

function CommitMessageFields({
  commitMessage,
  commitTitle,
  onCommitMessageChange,
  onCommitTitleChange
}: {
  commitMessage: string
  commitTitle: string
  onCommitMessageChange: (value: string) => void
  onCommitTitleChange: (value: string) => void
}): ReactElement {
  return (
    <div className="flex flex-col gap-1.5">
      <SectionLabel>Commit message</SectionLabel>

      <div className="flex flex-col rounded-md border border-border bg-card focus-within:border-ring">
        <Input
          aria-label="Commit title"
          className="h-8 rounded-b-none border-0 border-b border-border bg-transparent text-xs font-medium shadow-none focus-visible:ring-0 dark:bg-transparent"
          onChange={(event) => onCommitTitleChange(event.target.value)}
          placeholder="Commit title"
          value={commitTitle}
        />

        <Textarea
          aria-label="Commit description"
          className="max-h-48 min-h-14 resize-y rounded-t-none border-0 bg-transparent font-mono text-2xs leading-relaxed text-muted-foreground shadow-none focus-visible:ring-0 dark:bg-transparent"
          onChange={(event) => onCommitMessageChange(event.target.value)}
          placeholder="Commit description (optional)"
          value={commitMessage}
        />
      </div>
    </div>
  )
}

function SectionLabel({ children }: { children: string }): ReactElement {
  return (
    <span className="text-2xs font-semibold tracking-wider text-muted-foreground uppercase">
      {children}
    </span>
  )
}

function MergeDrawerFooter({
  baseName,
  canMerge,
  commits,
  mergeOptions,
  onMerge,
  selectedMethod,
  verdict
}: {
  baseName: string
  canMerge: boolean
  commits: string
  mergeOptions: MergeOptions | null
  onMerge: () => void
  selectedMethod: MergeMethod | null
  verdict: MergeVerdict
}): ReactElement {
  const [isConfirmingBypass, setIsConfirmingBypass] = useState(false)

  const isReady = canMerge && selectedMethod !== null

  return (
    <div className="flex w-full flex-col gap-2">
      <Button
        className="h-8 w-full font-semibold"
        disabled={!isReady}
        onClick={onMerge}
      >
        {selectedMethod ? mergeMethodLabels[selectedMethod] : 'Merge'}
      </Button>

      {isConfirmingBypass ? (
        <BypassConfirmation
          onCancel={() => setIsConfirmingBypass(false)}
          onConfirm={onMerge}
        />
      ) : (
        <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
          <span className="min-w-0 truncate">
            {isReady ? `${commits} into ${baseName}` : describeBlocked(verdict)}
          </span>

          {canBypassRules(canMerge, mergeOptions, selectedMethod) && (
            <button
              className="shrink-0 cursor-pointer hover:text-foreground hover:underline"
              onClick={() => setIsConfirmingBypass(true)}
              type="button"
            >
              Bypass rules…
            </button>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * Admins can merge past unmet rules, but never past conflicts, and only once
 * GitHub has said what the rules are.
 */
function canBypassRules(
  canMerge: boolean,
  mergeOptions: MergeOptions | null,
  selectedMethod: MergeMethod | null
): boolean {
  return (
    !canMerge &&
    selectedMethod !== null &&
    mergeOptions?.mergeable !== null &&
    mergeOptions?.mergeable !== undefined &&
    mergeOptions.mergeableState !== 'dirty'
  )
}

function describeBlocked(verdict: MergeVerdict): string {
  if (verdict.blockerCount === 0) {
    return verdict.detail
  }

  const items =
    verdict.blockerCount === 1
      ? '1 item'
      : `${verdict.blockerCount.toString()} items`

  return `Fix ${items} above to merge`
}

// The ellipsis on "Bypass rules…" promises a second step before anything
// happens; this is it.
function BypassConfirmation({
  onCancel,
  onConfirm
}: {
  onCancel: () => void
  onConfirm: () => void
}): ReactElement {
  return (
    <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
      <span>Merge without meeting the rules?</span>

      <div className="flex shrink-0 items-center gap-1.5">
        <Button
          onClick={onCancel}
          size="xs"
          variant="ghost"
        >
          Cancel
        </Button>

        <Button
          onClick={onConfirm}
          size="xs"
          variant="destructive"
        >
          Merge anyway
        </Button>
      </div>
    </div>
  )
}
