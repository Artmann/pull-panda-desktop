import {
  Columns2Icon,
  ExternalLinkIcon,
  Loader2,
  Rows3Icon,
  UnfoldVertical
} from 'lucide-react'
import { memo, useMemo, useState, type ReactElement } from 'react'
import { shallowEqual } from 'react-redux'
import { toast } from 'sonner'

import type { Comment, ModifiedFile } from '@/types/pull-request-details'
import type { PullRequest } from '@/types/pull-request'

import { Badge } from '@/app/components/ui/badge'
import { CopyToClipboardButton } from '@/app/components/CopyToClipboardButton'
import { getFileContents } from '@/app/lib/api'
import { useAppSelector } from '@/app/store/hooks'
import { type PendingReviewComment } from '@/app/store/pending-review-comments-slice'
import { isImagePath } from '@/lib/images'
import { useLandmark } from '@/app/pull-requests/PullRequestNavigationProvider'
import { FileCard, FileCardBody, FileCardHeader } from '../components/FileCard'
import {
  PierreDiff,
  type DiffLayout,
  type FullFileContents
} from '../diffs/PierreDiff'
import { ImageFileView } from './ImageFileView'

const emptyPendingComments: PendingReviewComment[] = []

// Full file contents are cached per file id so scrolling a card out of the
// virtualized list and back does not refetch. The cache is memory-only and
// lives for the session.
const fullFileCache = new Map<string, FullFileContents>()

interface ModifiedFileCardProps {
  eager?: boolean
  file: ModifiedFile
  layout?: DiffLayout
  pullRequest: PullRequest
}

export const ModifiedFileCard = memo(function ModifiedFileCard({
  eager = false,
  file,
  layout = 'unified',
  pullRequest
}: ModifiedFileCardProps): ReactElement {
  // Per-file layout override. Most files follow the global setting; this lets
  // a single diff be flipped between unified and split without affecting the
  // rest of the view. Session-only on purpose.
  const [layoutOverride, setLayoutOverride] = useState<DiffLayout | null>(null)
  const effectiveLayout = layoutOverride ?? layout

  const filePath = file.filePath
  const hasTextDiff = !isImagePath(filePath) && Boolean(file.diffHunk)
  const viewFileUrl = `https://github.com/${pullRequest.repositoryOwner}/${pullRequest.repositoryName}/blob/HEAD/${encodeURI(filePath)}`

  const [fullFile, setFullFile] = useState<FullFileContents | null>(
    () => fullFileCache.get(file.id) ?? null
  )
  const [isExpanding, setIsExpanding] = useState(false)

  const canExpand = hasTextDiff && !fullFile

  const handleExpand = () => {
    expandFullFile({
      file,
      fullFile,
      isExpanding,
      pullRequest,
      setFullFile,
      setIsExpanding
    })
  }

  const handleToggleLayout = () => {
    setLayoutOverride(toggleLayout(effectiveLayout))
  }

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
      <FileCard>
        <FileCardHeader>
          <div className="flex-1 flex items-center gap-2 font-mono text-xs">
            <span className="truncate">{file.filePath}</span>

            <CopyToClipboardButton value={file.filePath} />

            <FileStatusBadge status={file.status} />
          </div>

          <FileChangeStats
            additions={file.additions}
            deletions={file.deletions}
          />

          {hasTextDiff && (
            <LayoutToggleButton
              layout={effectiveLayout}
              onToggle={handleToggleLayout}
            />
          )}

          <ExpandFullFileButton
            canExpand={canExpand}
            isExpanding={isExpanding}
            onExpand={handleExpand}
          />

          <button
            className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
            onClick={() => {
              window.electron.openUrl(viewFileUrl)
            }}
            title="View file on GitHub"
            type="button"
          >
            <ExternalLinkIcon className="size-3" />
          </button>
        </FileCardHeader>

        <FileCardBody
          eager={eager}
          fallback={<DiffQueuedFallback />}
          lazy={Boolean(file.diffHunk)}
        >
          <ModifiedFileBody
            file={file}
            fullFile={fullFile}
            layout={effectiveLayout}
            pendingComments={filePendingComments}
            pullRequest={pullRequest}
            submittedComments={fileSubmittedComments}
          />
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

function expandFullFile({
  file,
  fullFile,
  isExpanding,
  pullRequest,
  setFullFile,
  setIsExpanding
}: {
  file: ModifiedFile
  fullFile: FullFileContents | null
  isExpanding: boolean
  pullRequest: PullRequest
  setFullFile: (contents: FullFileContents) => void
  setIsExpanding: (isExpanding: boolean) => void
}): void {
  if (fullFile || isExpanding) {
    return
  }

  setIsExpanding(true)

  getFileContents({
    blobSha: file.blobSha,
    owner: pullRequest.repositoryOwner,
    path: file.filePath,
    previousFilename: file.previousFilename,
    pullNumber: pullRequest.number,
    repo: pullRequest.repositoryName,
    status: file.status
  })
    .then((contents) => {
      fullFileCache.set(file.id, contents)
      setFullFile(contents)
      setIsExpanding(false)
    })
    .catch((error: unknown) => {
      setIsExpanding(false)
      toast.error(
        error instanceof Error ? error.message : 'Failed to load full file'
      )
    })
}

function ExpandFullFileButton({
  canExpand,
  isExpanding,
  onExpand
}: {
  canExpand: boolean
  isExpanding: boolean
  onExpand: () => void
}): ReactElement | null {
  if (!canExpand && !isExpanding) {
    return null
  }

  return (
    <button
      className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer disabled:opacity-50"
      disabled={isExpanding}
      onClick={onExpand}
      title="Load full file to expand unchanged lines"
      type="button"
    >
      {isExpanding ? (
        <Loader2 className="size-3 animate-spin" />
      ) : (
        <UnfoldVertical className="size-3" />
      )}
    </button>
  )
}

function FileChangeStats({
  additions,
  deletions
}: {
  additions: number | null
  deletions: number | null
}): ReactElement {
  return (
    <>
      {(additions ?? 0) > 0 && (
        <span className="text-status-success-foreground">+{additions}</span>
      )}

      {(deletions ?? 0) > 0 && (
        <span className="text-status-danger-foreground">-{deletions}</span>
      )}
    </>
  )
}

function FileStatusBadge({
  status
}: {
  status: string | null
}): ReactElement | null {
  if (status === 'added') {
    return (
      <Badge className="bg-status-success text-status-success-foreground border-status-success-border uppercase text-[0.6rem]">
        New
      </Badge>
    )
  }

  if (status === 'removed') {
    return (
      <Badge className="bg-status-danger text-status-danger-foreground border-status-danger-border uppercase text-[0.6rem]">
        Deleted
      </Badge>
    )
  }

  return null
}

function LayoutToggleButton({
  layout,
  onToggle
}: {
  layout: DiffLayout
  onToggle: () => void
}): ReactElement {
  const isUnified = layout === 'unified'

  return (
    <button
      className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
      onClick={onToggle}
      title={
        isUnified
          ? 'Switch this file to split view'
          : 'Switch this file to unified view'
      }
      type="button"
    >
      {isUnified ? (
        <Columns2Icon className="size-3" />
      ) : (
        <Rows3Icon className="size-3" />
      )}
    </button>
  )
}

function ModifiedFileBody({
  file,
  fullFile,
  layout,
  pendingComments,
  pullRequest,
  submittedComments
}: {
  file: ModifiedFile
  fullFile: FullFileContents | null
  layout: DiffLayout
  pendingComments: PendingReviewComment[]
  pullRequest: PullRequest
  submittedComments: Comment[]
}): ReactElement {
  if (isImagePath(file.filePath)) {
    return (
      <ImageFileView
        file={file}
        pullRequest={pullRequest}
      />
    )
  }

  if (!file.diffHunk) {
    return (
      <div className="py-2 px-3 text-muted-foreground">
        No changes to display.
      </div>
    )
  }

  return (
    <PierreDiff
      file={file}
      fullFile={fullFile ?? undefined}
      hideHeader
      layout={layout}
      pendingComments={pendingComments}
      pullRequest={pullRequest}
      registerCommentLandmarks={true}
      submittedComments={submittedComments}
    />
  )
}

function toggleLayout(layout: DiffLayout): DiffLayout {
  return layout === 'unified' ? 'split' : 'unified'
}
