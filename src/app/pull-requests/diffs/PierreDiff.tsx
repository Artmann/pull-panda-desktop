import {
  MultiFileDiff,
  PatchDiff,
  type AnnotationSide,
  type DiffLineAnnotation,
  type FileContents,
  type ThemeTypes
} from '@pierre/diffs/react'
import type { FileDiffOptions, GetHoveredLineResult } from '@pierre/diffs'
import { Plus } from 'lucide-react'
import { useTheme } from 'next-themes'
import {
  memo,
  useCallback,
  useMemo,
  useState,
  type ReactElement,
  type ReactNode
} from 'react'
import { shallowEqual } from 'react-redux'

import { Button } from '@/app/components/ui/button'
import { useAppTheme } from '@/app/lib/store/themeContext'
import { cn } from '@/app/lib/utils'
import { useAppSelector } from '@/app/store/hooks'
import type { PendingReviewComment } from '@/app/store/pending-review-comments-slice'
import { CommentReply } from '@/app/pull-requests/components/CommentReply'
import { useLandmark } from '@/app/pull-requests/PullRequestNavigationProvider'
import type { Comment } from '@/types/pull-request-details'
import type { PullRequest } from '@/types/pull-request'

import { buildPatch, type BuildPatchFile } from './build-patch'
import { InlineCommentInput } from './InlineCommentInput'
import { PendingComment } from './PendingComment'
import { toAnnotationSide, toGitHubSide } from './position'
import { SubmittedComment } from './SubmittedComment'

export type DiffLayout = 'split' | 'unified'

// Full old + new file contents, fetched on demand. When present the diff is
// rendered from the complete files (via `MultiFileDiff`), which unlocks
// expanding the unchanged context between hunks.
export interface FullFileContents {
  newContents: string
  oldContents: string
}

// Everything the annotation renderer needs to show the comment stack for a
// single (side, lineNumber) slot in the diff.
interface CommentSlot {
  key: string
  lineNumber: number
  pending: PendingReviewComment[]
  showInput: boolean
  side: AnnotationSide
  submitted: Comment[]
}

interface ActiveCommentSlot {
  lineNumber: number
  side: AnnotationSide
}

const emptyComments: Comment[] = []
const emptyPendingComments: PendingReviewComment[] = []
const emptySubmittedComments: Comment[] = []

// Maps each root comment's GitHub id to its replies, oldest first.
function groupRepliesByParent(comments: Comment[]): Map<string, Comment[]> {
  const map = new Map<string, Comment[]>()

  for (const comment of comments) {
    const parentId = comment.parentCommentGitHubId

    if (!parentId) {
      continue
    }

    const existing = map.get(parentId)

    if (existing) {
      existing.push(comment)
    } else {
      map.set(parentId, [comment])
    }
  }

  for (const replies of map.values()) {
    replies.sort((a, b) => {
      const aTime = new Date(a.gitHubCreatedAt ?? a.syncedAt).getTime()
      const bTime = new Date(b.gitHubCreatedAt ?? b.syncedAt).getTime()

      return aTime - bTime
    })
  }

  return map
}

// Groups submitted and pending comments, plus the open comment input when
// there is one, into a single annotation per (side, line) slot of the diff.
function buildCommentSlotAnnotations(
  submittedComments: Comment[],
  pendingComments: PendingReviewComment[],
  activeCommentSlot: ActiveCommentSlot | null
): DiffLineAnnotation<CommentSlot>[] {
  const slots = new Map<string, CommentSlot>()

  const ensureSlot = (
    side: AnnotationSide,
    lineNumber: number
  ): CommentSlot => {
    const key = `${side}:${String(lineNumber)}`
    const existing = slots.get(key)

    if (existing) {
      return existing
    }

    const slot: CommentSlot = {
      key,
      lineNumber,
      pending: [],
      showInput: false,
      side,
      submitted: []
    }

    slots.set(key, slot)

    return slot
  }

  for (const comment of submittedComments) {
    if (comment.parentCommentGitHubId) {
      continue
    }

    if (comment.line !== null) {
      ensureSlot('additions', comment.line).submitted.push(comment)
    } else if (comment.originalLine !== null) {
      ensureSlot('deletions', comment.originalLine).submitted.push(comment)
    }
  }

  for (const comment of pendingComments) {
    ensureSlot(toAnnotationSide(comment.side), comment.line).pending.push(
      comment
    )
  }

  if (activeCommentSlot) {
    ensureSlot(activeCommentSlot.side, activeCommentSlot.lineNumber).showInput =
      true
  }

  return [...slots.values()].map((slot) => ({
    lineNumber: slot.lineNumber,
    metadata: slot,
    side: slot.side
  }))
}

interface PierreDiffProps {
  className?: string
  file: BuildPatchFile
  fullFile?: FullFileContents
  hideHeader?: boolean
  layout?: DiffLayout
  pendingComments?: PendingReviewComment[]
  pullRequest?: PullRequest
  registerCommentLandmarks?: boolean
  submittedComments?: Comment[]
}

export const PierreDiff = memo(function PierreDiff({
  className,
  file,
  fullFile,
  hideHeader = false,
  layout = 'unified',
  pendingComments = emptyPendingComments,
  pullRequest,
  registerCommentLandmarks = false,
  submittedComments = emptySubmittedComments
}: PierreDiffProps): ReactElement {
  const { appTheme } = useAppTheme()
  const { resolvedTheme } = useTheme()

  const darkTheme = appTheme.darkShikiTheme
  const lightTheme = appTheme.lightShikiTheme
  const themeType: ThemeTypes = resolvedTheme === 'dark' ? 'dark' : 'light'

  const canComment = Boolean(pullRequest)

  const [activeCommentSlot, setActiveCommentSlot] =
    useState<ActiveCommentSlot | null>(null)
  const [expandedReplyThreads, setExpandedReplyThreads] = useState<Set<string>>(
    new Set()
  )

  const pullRequestId = pullRequest?.id ?? null

  const allPullRequestComments = useAppSelector((state) => {
    if (!pullRequestId) {
      return emptyComments
    }

    return state.comments.items.filter((c) => c.pullRequestId === pullRequestId)
  }, shallowEqual)

  const childrenByParentGitHubId = useMemo(
    () => groupRepliesByParent(allPullRequestComments),
    [allPullRequestComments]
  )

  const toggleReplyForm = useCallback((threadKey: string) => {
    setExpandedReplyThreads((previous) => {
      const next = new Set(previous)

      if (next.has(threadKey)) {
        next.delete(threadKey)
      } else {
        next.add(threadKey)
      }

      return next
    })
  }, [])

  const handleCloseComment = useCallback(() => {
    setActiveCommentSlot(null)
  }, [])

  const patch = useMemo(
    () => buildPatch(file),
    [file.diffHunk, file.filePath, file.previousFilename, file.status]
  )

  const lineAnnotations = useMemo(
    () =>
      buildCommentSlotAnnotations(
        submittedComments,
        pendingComments,
        activeCommentSlot
      ),
    [submittedComments, pendingComments, activeCommentSlot]
  )

  const options = useMemo<FileDiffOptions<CommentSlot>>(() => {
    const base: FileDiffOptions<CommentSlot> = {
      diffStyle: layout,
      disableFileHeader: hideHeader,
      expandUnchanged: Boolean(fullFile),
      theme: { dark: darkTheme, light: lightTheme },
      themeType
    }

    if (!canComment) {
      return base
    }

    return {
      ...base,
      enableGutterUtility: true,
      lineHoverHighlight: 'both',
      onLineNumberClick: ({ annotationSide, lineNumber }) => {
        setActiveCommentSlot({ lineNumber, side: annotationSide })
      },
      // The gutter comment button overlays the hovered line-number cell, so
      // hide the number underneath instead of letting the two fight, and
      // align the button with the right-aligned digits (the cell has 0.6em of
      // right padding); the package default pins it to the top-right corner.
      unsafeCSS: `
        [data-column-number][data-hovered] { color: transparent; }
        [data-gutter-utility-slot] {
          inset: 0;
          justify-content: flex-end;
          padding-right: 0.6em;
        }
      `
    }
  }, [
    canComment,
    darkTheme,
    fullFile,
    hideHeader,
    layout,
    lightTheme,
    themeType
  ])

  const files = useMemo<{
    newFile: FileContents
    oldFile: FileContents
  } | null>(() => {
    if (!fullFile) {
      return null
    }

    return {
      newFile: { contents: fullFile.newContents, name: file.filePath },
      oldFile: {
        contents: fullFile.oldContents,
        name: file.previousFilename ?? file.filePath
      }
    }
  }, [fullFile, file.filePath, file.previousFilename])

  const renderGutterUtility = useCallback(
    (
      getHoveredLine: () => GetHoveredLineResult<'diff'> | undefined
    ): ReactNode => (
      <div className="flex h-full items-center justify-center">
        <button
          className="flex size-4 items-center justify-center rounded bg-primary text-primary-foreground"
          onClick={() => {
            const hovered = getHoveredLine()

            if (hovered) {
              setActiveCommentSlot({
                lineNumber: hovered.lineNumber,
                side: hovered.side
              })
            }
          }}
          title="Add a comment"
          type="button"
        >
          <Plus className="size-3" />
        </button>
      </div>
    ),
    []
  )

  const renderAnnotation = useCallback(
    (annotation: DiffLineAnnotation<CommentSlot>): ReactNode => {
      if (!pullRequest) {
        return null
      }

      return (
        <DiffCommentSlot
          childrenByParentGitHubId={childrenByParentGitHubId}
          expandedReplyThreads={expandedReplyThreads}
          filePath={file.filePath}
          onCloseInput={handleCloseComment}
          onToggleReply={toggleReplyForm}
          pullRequest={pullRequest}
          registerCommentLandmarks={registerCommentLandmarks}
          slot={annotation.metadata}
        />
      )
    },
    [
      childrenByParentGitHubId,
      expandedReplyThreads,
      file.filePath,
      handleCloseComment,
      pullRequest,
      registerCommentLandmarks,
      toggleReplyForm
    ]
  )

  const sharedProps = {
    className: cn('pierre-diff', className),
    lineAnnotations,
    options,
    renderAnnotation,
    renderGutterUtility: canComment ? renderGutterUtility : undefined
  }

  if (files) {
    return (
      <MultiFileDiff<CommentSlot>
        {...sharedProps}
        newFile={files.newFile}
        oldFile={files.oldFile}
      />
    )
  }

  return (
    <PatchDiff<CommentSlot>
      {...sharedProps}
      patch={patch}
    />
  )
})

interface DiffCommentSlotProps {
  childrenByParentGitHubId: Map<string, Comment[]>
  expandedReplyThreads: Set<string>
  filePath: string
  onCloseInput: () => void
  onToggleReply: (threadKey: string) => void
  pullRequest: PullRequest
  registerCommentLandmarks: boolean
  slot: CommentSlot
}

function DiffCommentSlot({
  childrenByParentGitHubId,
  expandedReplyThreads,
  filePath,
  onCloseInput,
  onToggleReply,
  pullRequest,
  registerCommentLandmarks,
  slot
}: DiffCommentSlotProps): ReactElement {
  return (
    <div className="font-sans">
      {slot.submitted.map((rootComment) => {
        const replies = childrenByParentGitHubId.get(rootComment.gitHubId) ?? []
        const threadKey =
          rootComment.gitHubReviewThreadId ?? rootComment.gitHubId
        const isReplyOpen = expandedReplyThreads.has(threadKey)
        const canReply = rootComment.gitHubReviewThreadId !== null

        const rootElement = registerCommentLandmarks ? (
          <LandmarkWrapper id={`file-comment-${rootComment.id}`}>
            <SubmittedComment comment={rootComment} />
          </LandmarkWrapper>
        ) : (
          <SubmittedComment comment={rootComment} />
        )

        return (
          <div key={rootComment.id}>
            {rootElement}

            {replies.map((reply) => (
              <div
                className="ml-6 border-l border-border pl-3"
                key={reply.id}
              >
                <SubmittedComment comment={reply} />
              </div>
            ))}

            {canReply && (
              <div className="border-l-3 border-l-primary border-border border-y bg-background px-3 py-2 font-sans">
                {isReplyOpen ? (
                  <CommentReply
                    comment={rootComment}
                    pullRequest={pullRequest}
                  />
                ) : (
                  <Button
                    onClick={() => onToggleReply(threadKey)}
                    size="xs"
                    variant="ghost"
                  >
                    Reply
                  </Button>
                )}
              </div>
            )}
          </div>
        )
      })}

      {slot.pending.map((comment) =>
        registerCommentLandmarks ? (
          <LandmarkWrapper
            id={`file-pending-comment-${comment.id}`}
            key={comment.id}
          >
            <PendingComment
              comment={comment}
              pullRequestId={pullRequest.id}
            />
          </LandmarkWrapper>
        ) : (
          <PendingComment
            comment={comment}
            key={comment.id}
            pullRequestId={pullRequest.id}
          />
        )
      )}

      {slot.showInput && (
        <InlineCommentInput
          filePath={filePath}
          line={slot.lineNumber}
          onCancel={onCloseInput}
          pullRequest={pullRequest}
          side={toGitHubSide(slot.side)}
        />
      )}
    </div>
  )
}

function LandmarkWrapper({
  children,
  id
}: {
  children: ReactElement
  id: string
}): ReactElement {
  const landmarkRef = useLandmark(id)

  return <div ref={landmarkRef}>{children}</div>
}
