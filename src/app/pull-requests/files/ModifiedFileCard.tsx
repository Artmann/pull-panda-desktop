import { ExternalLinkIcon } from 'lucide-react'
import { useTheme } from 'next-themes'
import { memo, useMemo, useState, type ReactElement } from 'react'
import { shallowEqual } from 'react-redux'

import type { Comment, ModifiedFile } from '@/types/pull-request-details'
import type { PullRequest } from '@/types/pull-request'

import { Badge } from '@/app/components/ui/badge'
import { CopyToClipboardButton } from '@/app/components/CopyToClipboardButton'
import { cn } from '@/app/lib/utils'
import { useAppTheme } from '@/app/lib/store/themeContext'
import { useAppSelector } from '@/app/store/hooks'
import { type PendingReviewComment } from '@/app/store/pending-review-comments-slice'
import { useLandmark } from '@/app/pull-requests/PullRequestNavigationProvider'
import { FileCard, FileCardBody, FileCardHeader } from '../components/FileCard'
import { SimpleDiff } from '../diffs/SimpleDiff'

const emptyPendingComments: PendingReviewComment[] = []

type FileView = 'implementation' | 'test'

interface ModifiedFileCardProps {
  eager?: boolean
  file: ModifiedFile
  missingTest?: boolean
  pullRequest: PullRequest
  testFile?: ModifiedFile | null
}

export const ModifiedFileCard = memo(function ModifiedFileCard({
  eager = false,
  file,
  missingTest = false,
  pullRequest,
  testFile = null
}: ModifiedFileCardProps): ReactElement {
  const { appTheme } = useAppTheme()
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const backgroundColor = isDark
    ? appTheme.dark.background
    : appTheme.light.background

  const [view, setView] = useState<FileView>('implementation')

  const activeFile = view === 'test' && testFile ? testFile : file
  const filePath = activeFile.filePath
  const viewFileUrl = `https://github.com/${pullRequest.repositoryOwner}/${pullRequest.repositoryName}/blob/HEAD/${encodeURI(filePath)}`

  const allPendingComments = useAppSelector(
    (state) =>
      state.pendingReviewComments[pullRequest.id] ?? emptyPendingComments
  )

  const allSubmittedComments: Comment[] = useAppSelector(
    (state) =>
      state.comments.items.filter((c) => c.pullRequestId === pullRequest.id),
    shallowEqual
  )

  const filePendingComments = useMemo(
    () => allPendingComments.filter((comment) => comment.path === filePath),
    [allPendingComments, filePath]
  )

  const fileSubmittedComments = useMemo(
    () => allSubmittedComments.filter((comment) => comment.path === filePath),
    [allSubmittedComments, filePath]
  )

  const landmarkRef = useLandmark(`file-${file.filePath}`)

  return (
    <div ref={landmarkRef}>
      <FileCard style={{ backgroundColor }}>
        <FileCardHeader>
          <div className="flex-1 flex items-center gap-2 font-mono text-xs">
            <span className="truncate">{activeFile.filePath}</span>

            <CopyToClipboardButton value={activeFile.filePath} />

            {activeFile.status === 'added' && (
              <Badge className="bg-status-success text-status-success-foreground border-status-success-border uppercase text-[0.6rem]">
                New
              </Badge>
            )}

            {activeFile.status === 'removed' && (
              <Badge className="bg-status-danger text-status-danger-foreground border-status-danger-border uppercase text-[0.6rem]">
                Deleted
              </Badge>
            )}

            {missingTest && !testFile && (
              <Badge
                className="uppercase text-[0.6rem]"
                variant="outline"
              >
                Missing test
              </Badge>
            )}
          </div>

          {testFile && (
            <FileViewToggle
              value={view}
              onChange={setView}
            />
          )}

          <button
            className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            onClick={() => {
              window.electron.openUrl(viewFileUrl)
            }}
            title="View file on GitHub"
          >
            <ExternalLinkIcon className="size-3" />
          </button>
        </FileCardHeader>

        <FileCardBody
          key={activeFile.filePath}
          eager={eager}
          fallback={<DiffQueuedFallback />}
          lazy={Boolean(activeFile.diffHunk)}
        >
          {activeFile.diffHunk ? (
            <SimpleDiff
              diffHunk={activeFile.diffHunk}
              filePath={activeFile.filePath}
              pendingComments={filePendingComments}
              pullRequest={pullRequest}
              registerCommentLandmarks={true}
              submittedComments={fileSubmittedComments}
            />
          ) : (
            <div className="py-2 px-3 text-muted-foreground">
              No changes to display.
            </div>
          )}
        </FileCardBody>
      </FileCard>
    </div>
  )
})

function FileViewToggle({
  onChange,
  value
}: {
  onChange: (value: FileView) => void
  value: FileView
}): ReactElement {
  const options: Array<{ label: string; value: FileView }> = [
    { label: 'Implementation', value: 'implementation' },
    { label: 'Test', value: 'test' }
  ]

  return (
    <div className="inline-flex items-center gap-0.5 rounded-md border border-border p-0.5">
      {options.map((option) => {
        const isSelected = option.value === value

        return (
          <button
            key={option.value}
            aria-pressed={isSelected}
            className={cn(
              'cursor-pointer rounded-sm px-2 py-0.5 text-[0.6rem] font-medium uppercase transition-colors',
              isSelected
                ? 'bg-muted text-foreground'
                : 'text-muted-foreground hover:text-foreground'
            )}
            onClick={() => {
              onChange(option.value)
            }}
            type="button"
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

function DiffQueuedFallback(): ReactElement {
  return (
    <div className="px-3 py-3 text-xs text-muted-foreground">
      Diff rendering queued.
    </div>
  )
}
