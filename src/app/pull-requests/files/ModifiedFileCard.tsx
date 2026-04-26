import { ExternalLinkIcon } from 'lucide-react'
import { useTheme } from 'next-themes'
import { memo, useMemo, type ReactElement } from 'react'
import { shallowEqual } from 'react-redux'

import type { Comment, ModifiedFile } from '@/types/pull-request-details'
import type { PullRequest } from '@/types/pull-request'

import { Badge } from '@/app/components/ui/badge'
import { CopyToClipboardButton } from '@/app/components/CopyToClipboardButton'
import { useAppTheme } from '@/app/lib/store/themeContext'
import { useAppSelector } from '@/app/store/hooks'
import { type PendingReviewComment } from '@/app/store/pending-review-comments-slice'
import { useLandmark } from '@/app/pull-requests/PullRequestNavigationProvider'
import { FileCard, FileCardBody, FileCardHeader } from '../components/FileCard'
import { SimpleDiff } from '../diffs/SimpleDiff'

const emptyPendingComments: PendingReviewComment[] = []

interface ModifiedFileCardProps {
  eager?: boolean
  file: ModifiedFile
  pullRequest: PullRequest
}

export const ModifiedFileCard = memo(function ModifiedFileCard({
  eager = false,
  file,
  pullRequest
}: ModifiedFileCardProps): ReactElement {
  const { appTheme } = useAppTheme()
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const backgroundColor = isDark
    ? appTheme.dark.background
    : appTheme.light.background

  const filePath = file.filePath
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

  const landmarkRef = useLandmark(`file-${filePath}`)

  return (
    <div ref={landmarkRef}>
    <FileCard style={{ backgroundColor }}>
      <FileCardHeader>
        <div className="flex-1 flex items-center gap-2 font-mono text-xs">
          <span className="truncate">{file.filePath}</span>

          <CopyToClipboardButton value={file.filePath} />

          {file.status === 'added' && (
            <Badge className="bg-status-success text-status-success-foreground border-status-success-border uppercase text-[0.6rem]">
              New
            </Badge>
          )}

          {file.status === 'removed' && (
            <Badge className="bg-status-danger text-status-danger-foreground border-status-danger-border uppercase text-[0.6rem]">
              Deleted
            </Badge>
          )}
        </div>

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
        eager={eager}
        fallback={<DiffQueuedFallback />}
        lazy={Boolean(file.diffHunk)}
      >
        {file.diffHunk ? (
          <SimpleDiff
            diffHunk={file.diffHunk}
            filePath={file.filePath}
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

function DiffQueuedFallback(): ReactElement {
  return (
    <div className="px-3 py-3 text-xs text-muted-foreground">
      Diff rendering queued.
    </div>
  )
}
