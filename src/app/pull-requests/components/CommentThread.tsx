import {
  Check,
  CheckIcon,
  ChevronDown,
  CircleCheck,
  Code2,
  Loader2,
  SparklesIcon
} from 'lucide-react'
import {
  Fragment,
  memo,
  useCallback,
  useState,
  type ReactElement,
  type ReactNode
} from 'react'
import { shallowEqual } from 'react-redux'
import { toast } from 'sonner'

import type { PullRequest } from '@/types/pull-request'
import type { Comment, ReviewThread } from '@/types/pull-request-details'

import { cn } from '@/app/lib/utils'
import { TimeAgo } from '@/app/components/TimeAgo'
import { Avatar, AvatarFallback, AvatarImage } from '@/app/components/ui/avatar'
import { Button } from '@/app/components/ui/button'
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle
} from '@/app/components/ui/card'
import { Separator } from '@/app/components/ui/separator'
import { resolveReviewThread, unresolveReviewThread } from '@/app/lib/api'
import { runOptimisticMutation } from '@/app/lib/mutations/run-optimistic-mutation'
import { useAppDispatch, useAppSelector } from '@/app/store/hooks'
import { reviewThreadsActions } from '@/app/store/review-threads-slice'

import { CommentBody } from './CommentBody'
import { CommentReply } from './CommentReply'
import { PierreDiff } from '../diffs/PierreDiff'

interface CommentThreadProps {
  anchorHeaderExtra?: ReactNode
  comment: Comment
  allComments: Comment[]
  hideAuthor?: boolean
  showPromptButton?: boolean
  variant?: 'card' | 'inline'
}

const CommentThread = memo(function CommentThread({
  anchorHeaderExtra,
  comment,
  allComments,
  hideAuthor = false,
  showPromptButton = false,
  variant = 'card'
}: CommentThreadProps): ReactElement {
  const childComments = allComments.filter(
    (c) => c.parentCommentGitHubId === comment.gitHubId
  )

  return (
    <>
      <CommentItem
        comment={comment}
        headerExtra={anchorHeaderExtra}
        hideAuthor={hideAuthor}
        showPromptButton={showPromptButton}
        variant={variant}
      />

      {childComments.length > 0 && (
        <div className="border-t border-border">
          {childComments.map((childComment, index) => (
            <Fragment key={childComment.id}>
              {index > 0 && <Separator />}
              <CommentItem
                comment={childComment}
                hideAuthor={false}
                showPromptButton={showPromptButton}
                variant={variant}
              />
            </Fragment>
          ))}
        </div>
      )}
    </>
  )
})

interface CommentItemProps {
  comment: Comment
  headerExtra?: ReactNode
  hideAuthor?: boolean
  showPromptButton?: boolean
  variant?: 'card' | 'inline'
}

function commentItemClassName(variant: 'card' | 'inline'): string {
  const horizontalPadding = variant === 'inline' ? 'px-3.5' : 'px-4'

  return cn(
    'relative flex flex-col w-full pt-4 pb-5 gap-1.5',
    horizontalPadding
  )
}

const CommentItem = memo(function CommentItem({
  comment,
  headerExtra,
  hideAuthor = false,
  showPromptButton = false,
  variant = 'card'
}: CommentItemProps): ReactElement {
  return (
    <div className={commentItemClassName(variant)}>
      <CommentItemHeader
        comment={comment}
        headerExtra={headerExtra}
        hideAuthor={hideAuthor}
        showPromptButton={showPromptButton}
      />

      {comment.body && (
        <CommentBody
          content={comment.body}
          path={comment.path ?? undefined}
        />
      )}
    </div>
  )
})

interface CommentItemHeaderProps {
  comment: Comment
  headerExtra?: ReactNode
  hideAuthor: boolean
  showPromptButton: boolean
}

function CommentItemHeader({
  comment,
  headerExtra,
  hideAuthor,
  showPromptButton
}: CommentItemHeaderProps): ReactElement | null {
  const actions = (showPromptButton || headerExtra) && (
    <div className="flex items-center gap-1">
      {showPromptButton && <CopyAsPromptButton comment={comment} />}
      {headerExtra}
    </div>
  )

  if (hideAuthor) {
    // Without an author row there is nothing else on this line — overlay the
    // actions in the corner instead of reserving an empty row of whitespace
    // between the diff excerpt and the comment body.
    return actions ? (
      <div className="absolute top-2 right-2">{actions}</div>
    ) : null
  }

  return (
    <div className="flex items-center justify-between">
      <CommentAuthorInfo comment={comment} />
      {actions}
    </div>
  )
}

interface CommentAuthorInfoProps {
  comment: Comment
}

function CommentAuthorInfo({ comment }: CommentAuthorInfoProps): ReactElement {
  const login = comment.userLogin ?? ''
  const fallback = (comment.userLogin ?? '??').slice(0, 2)

  return (
    <div className="flex items-center gap-2">
      <Avatar className="size-5 text-xs">
        <AvatarImage
          alt={login}
          src={comment.userAvatarUrl ?? undefined}
        />
        <AvatarFallback className="uppercase">{fallback}</AvatarFallback>
      </Avatar>

      <div className="flex gap-2 text-xs">
        <div className="font-medium">{comment.userLogin}</div>
        {comment.gitHubCreatedAt && (
          <TimeAgo dateTime={comment.gitHubCreatedAt} />
        )}
      </div>
    </div>
  )
}

interface CopyAsPromptButtonProps {
  comment: Comment
}

const CopyAsPromptButton = memo(function CopyAsPromptButton({
  comment
}: CopyAsPromptButtonProps): ReactElement {
  const [hasBeenClicked, setHasBeenClicked] = useState(false)

  const handleClick = useCallback(() => {
    const prompt = formatCommentAsPrompt(comment)

    setHasBeenClicked(true)

    navigator.clipboard
      .writeText(prompt)
      .then(() => {
        setTimeout(() => {
          setHasBeenClicked(false)
        }, 1_400)
      })
      .catch((error: unknown) => {
        console.error('Failed to copy prompt to clipboard:', error)
        setHasBeenClicked(false)
        toast.error('Failed to copy prompt to clipboard')
      })
  }, [comment])

  return (
    <Button
      aria-label="Copy as AI prompt"
      className="relative"
      onClick={handleClick}
      size="icon-sm"
      title="Copy as AI prompt"
      variant="ghost"
    >
      <div className="size-3">
        <SparklesIcon
          className={cn(
            'absolute size-3 transition-all ease-in-out',
            hasBeenClicked
              ? 'scale-0 opacity-0 blur-sm'
              : 'scale-100 opacity-100 blur-0'
          )}
        />
        <CheckIcon
          className={cn(
            'absolute size-3 transition-all ease-in-out',
            hasBeenClicked
              ? 'scale-100 opacity-100 blur-0'
              : 'scale-0 opacity-0 blur-sm'
          )}
        />
      </div>
    </Button>
  )
})

function formatCommentAsPrompt(comment: Comment): string {
  const lines: string[] = []

  if (comment.path) {
    const location = comment.line
      ? `${comment.path}:${comment.line.toString()}`
      : comment.path

    lines.push(`File: ${location}`)
  }

  if (comment.diffHunk) {
    lines.push('```')
    lines.push(comment.diffHunk)
    lines.push('```')
    lines.push('')
  }

  const author = comment.userLogin ?? 'Reviewer'
  const body = (comment.body ?? '').trim()

  lines.push(`${author} said:`)
  lines.push(`"${body}"`)
  lines.push('')
  lines.push('Please address this review comment.')

  return lines.join('\n')
}

interface ResolveThreadButtonProps {
  appearance?: 'default' | 'quiet' | 'icon'
  pullRequest: PullRequest
  thread: ReviewThread
}

const ResolveThreadButton = memo(function ResolveThreadButton({
  appearance = 'default',
  pullRequest,
  thread
}: ResolveThreadButtonProps): ReactElement {
  const dispatch = useAppDispatch()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleClick = useCallback(() => {
    if (isSubmitting) {
      return
    }

    const wasResolved = thread.isResolved
    const previousResolvedByLogin = thread.resolvedByLogin
    const action = wasResolved ? unresolveReviewThread : resolveReviewThread

    setIsSubmitting(true)

    runOptimisticMutation({
      optimistic: () =>
        dispatch(
          reviewThreadsActions.updateResolution({
            gitHubId: thread.gitHubId,
            isResolved: !wasResolved,
            resolvedByLogin: wasResolved ? null : previousResolvedByLogin
          })
        ),
      request: () =>
        action({
          owner: pullRequest.repositoryOwner,
          pullNumber: pullRequest.number,
          repo: pullRequest.repositoryName,
          threadId: thread.gitHubId
        }),
      commit: (response) =>
        dispatch(
          reviewThreadsActions.updateResolution({
            gitHubId: response.gitHubId,
            isResolved: response.isResolved,
            resolvedByLogin: response.resolvedByLogin
          })
        ),
      rollback: () =>
        dispatch(
          reviewThreadsActions.updateResolution({
            gitHubId: thread.gitHubId,
            isResolved: wasResolved,
            resolvedByLogin: previousResolvedByLogin
          })
        ),
      settled: () => setIsSubmitting(false),
      errorMessage: wasResolved
        ? 'Failed to unresolve thread'
        : 'Failed to resolve thread'
    })
  }, [dispatch, isSubmitting, pullRequest, thread])

  const display = resolveButtonDisplay(appearance, thread.isResolved)

  return (
    <Button
      aria-label={display.ariaLabel}
      disabled={isSubmitting}
      onClick={handleClick}
      size={display.size}
      title={display.title}
      variant={display.variant}
    >
      {isSubmitting ? (
        <Loader2 className="size-3 animate-spin" />
      ) : thread.isResolved ? (
        <CircleCheck className="size-3" />
      ) : (
        <Check className="size-3" />
      )}
      {display.showLabel && display.label}
    </Button>
  )
})

interface ResolveButtonDisplay {
  ariaLabel: string | undefined
  label: string
  showLabel: boolean
  size: 'icon-sm' | 'sm'
  title: string | undefined
  variant: 'ghost' | 'outline'
}

function resolveButtonDisplay(
  appearance: 'default' | 'quiet' | 'icon',
  isResolved: boolean
): ResolveButtonDisplay {
  const label = isResolved ? 'Unresolve' : 'Resolve'

  if (appearance === 'icon') {
    return {
      ariaLabel: label,
      label,
      showLabel: false,
      size: 'icon-sm',
      title: label,
      variant: 'ghost'
    }
  }

  const variant =
    appearance === 'quiet' || isResolved
      ? ('ghost' as const)
      : ('outline' as const)

  return {
    ariaLabel: undefined,
    label,
    showLabel: true,
    size: 'sm',
    title: undefined,
    variant
  }
}

interface ResolvedBadgeProps {
  thread: ReviewThread
}

function ResolvedBadge({ thread }: ResolvedBadgeProps): ReactElement {
  return (
    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
      <CircleCheck className="size-3" />
      <span>
        Resolved
        {thread.resolvedByLogin ? ` by ${thread.resolvedByLogin}` : ''}
      </span>
    </div>
  )
}

function isCommentOutdated(comment: Comment): boolean {
  return comment.path !== null && comment.line === null
}

function OutdatedBadge(): ReactElement {
  return (
    <span
      className={cn(
        'inline-flex items-center rounded px-1.5 py-0.5',
        'text-[10px] font-mono font-semibold uppercase tracking-wider',
        'border border-border bg-muted text-muted-foreground'
      )}
    >
      Outdated
    </span>
  )
}

function renderCommentDiff(comment: Comment): ReactElement | null {
  if (!comment.diffHunk) {
    return null
  }

  return (
    // Show at most a handful of context lines, anchored to the bottom of the
    // hunk — that is where the commented line sits. Mirrors GitHub, which
    // never renders a comment's full stored hunk.
    <div className="flex max-h-44 flex-col justify-end overflow-hidden">
      <PierreDiff
        className="pierre-diff--compact"
        file={{ diffHunk: comment.diffHunk, filePath: comment.path ?? '' }}
        hideHeader
      />
    </div>
  )
}

function useReviewThread(threadGitHubId: string | null): ReviewThread | null {
  return useAppSelector((state) => {
    if (!threadGitHubId) {
      return null
    }

    return (
      state.reviewThreads.items.find(
        (item) => item.gitHubId === threadGitHubId
      ) ?? null
    )
  }, shallowEqual)
}

interface CommentThreadCardProps {
  comment: Comment
  allComments: Comment[]
  hideAuthor?: boolean
  pullRequest?: PullRequest
  showPromptButton?: boolean
  variant?: 'card' | 'inline'
}

export const CommentThreadCard = memo(function CommentThreadCard({
  comment,
  allComments,
  hideAuthor = false,
  pullRequest,
  showPromptButton = false,
  variant = 'card'
}: CommentThreadCardProps): ReactElement {
  const isReviewComment = comment.gitHubReviewThreadId !== null
  const thread = useReviewThread(comment.gitHubReviewThreadId)
  const isInline = variant === 'inline'

  const resolveIconButton = pullRequest && thread && (
    <ResolveThreadButton
      appearance="icon"
      pullRequest={pullRequest}
      thread={thread}
    />
  )

  const cardFooter = pullRequest && isReviewComment && (
    <>
      {thread?.isResolved && <ResolvedBadge thread={thread} />}
      <CommentReply
        comment={comment}
        pullRequest={pullRequest}
      />
    </>
  )

  if (isInline) {
    return (
      <div className={cn('w-full', thread?.isResolved && 'opacity-70')}>
        <CommentThread
          anchorHeaderExtra={resolveIconButton}
          comment={comment}
          allComments={allComments}
          hideAuthor={hideAuthor}
          showPromptButton={showPromptButton}
          variant="inline"
        />
        {pullRequest && isReviewComment && (
          <InlineFooter
            comment={comment}
            pullRequest={pullRequest}
          />
        )}
      </div>
    )
  }

  return (
    <Card
      className={cn(
        // overflow-hidden clips the square-cornered file header (and diff
        // excerpt) to the card's rounded corners.
        'p-0 w-full gap-0 shadow-none overflow-hidden',
        thread?.isResolved && 'opacity-70'
      )}
    >
      <CardContent className="p-0 w-full">
        <CommentThread
          anchorHeaderExtra={resolveIconButton}
          comment={comment}
          allComments={allComments}
          hideAuthor={hideAuthor}
          showPromptButton={showPromptButton}
        />
      </CardContent>
      {cardFooter && (
        <CardFooter className="px-3 pt-1! pb-2 border-t border-border flex flex-col items-stretch gap-2">
          {cardFooter}
        </CardFooter>
      )}
    </Card>
  )
})

interface FileCommentThreadCardProps {
  comment: Comment
  allComments: Comment[]
  collapseWhenOutdated?: boolean
  hideAuthor?: boolean
  pullRequest?: PullRequest
  showPromptButton?: boolean
  variant?: 'card' | 'inline'
}

export const FileCommentThreadCard = memo(function FileCommentThreadCard({
  comment,
  allComments,
  collapseWhenOutdated = false,
  hideAuthor = false,
  pullRequest,
  showPromptButton = false,
  variant = 'card'
}: FileCommentThreadCardProps): ReactElement {
  const thread = useReviewThread(comment.gitHubReviewThreadId)
  const isOutdated = isCommentOutdated(comment)
  const [isExpanded, setIsExpanded] = useState(false)

  const handleToggle = useCallback(() => {
    setIsExpanded((value) => !value)
  }, [])

  if (variant === 'inline') {
    return (
      <FileCommentInlineView
        comment={comment}
        allComments={allComments}
        hideAuthor={hideAuthor}
        isOutdated={isOutdated}
        pullRequest={pullRequest}
        showPromptButton={showPromptButton}
        thread={thread}
      />
    )
  }

  return (
    <FileCommentCardView
      comment={comment}
      allComments={allComments}
      hideAuthor={hideAuthor}
      isCollapsible={collapseWhenOutdated && isOutdated}
      isExpanded={isExpanded}
      isOutdated={isOutdated}
      onToggle={handleToggle}
      pullRequest={pullRequest}
      showPromptButton={showPromptButton}
      thread={thread}
    />
  )
})

interface FileCommentInlineViewProps {
  comment: Comment
  allComments: Comment[]
  hideAuthor: boolean
  isOutdated: boolean
  pullRequest?: PullRequest
  showPromptButton: boolean
  thread: ReviewThread | null
}

function FileCommentInlineView({
  comment,
  allComments,
  hideAuthor,
  isOutdated,
  pullRequest,
  showPromptButton,
  thread
}: FileCommentInlineViewProps): ReactElement {
  return (
    <div className={cn('w-full', thread?.isResolved && 'opacity-70')}>
      <div className="flex items-center gap-2 px-3.5 pt-3 pb-3 pr-12 text-xs font-mono text-muted-foreground">
        <Code2 className="size-3.5 shrink-0" />
        <span
          className="min-w-0 flex-1 truncate"
          title={comment.path ?? undefined}
        >
          {comment.path}
        </span>
        {isOutdated && <OutdatedBadge />}
      </div>

      {renderCommentDiff(comment)}

      <CommentThread
        anchorHeaderExtra={renderResolveIconButton(pullRequest, thread)}
        comment={comment}
        allComments={allComments}
        hideAuthor={hideAuthor}
        showPromptButton={showPromptButton}
        variant="inline"
      />

      {pullRequest && (
        <InlineFooter
          comment={comment}
          pullRequest={pullRequest}
        />
      )}
    </div>
  )
}

interface FileCommentCardViewProps {
  comment: Comment
  allComments: Comment[]
  hideAuthor: boolean
  isCollapsible: boolean
  isExpanded: boolean
  isOutdated: boolean
  onToggle: () => void
  pullRequest?: PullRequest
  showPromptButton: boolean
  thread: ReviewThread | null
}

function FileCommentCardView({
  comment,
  allComments,
  hideAuthor,
  isCollapsible,
  isExpanded,
  isOutdated,
  onToggle,
  pullRequest,
  showPromptButton,
  thread
}: FileCommentCardViewProps): ReactElement {
  const cardFooter = renderFileCardFooter(comment, pullRequest, thread)
  const showContent = !isCollapsible || isExpanded

  return (
    <Card
      className={cn(
        // overflow-hidden clips the square-cornered file header (and diff
        // excerpt) to the card's rounded corners.
        'p-0 w-full gap-0 shadow-none overflow-hidden',
        thread?.isResolved && 'opacity-70'
      )}
    >
      <FileCommentHeader
        comment={comment}
        isCollapsible={isCollapsible}
        isExpanded={isExpanded}
        isOutdated={isOutdated}
        onToggle={onToggle}
      />

      {showContent && (
        <CardContent className="p-0 w-full">
          {renderCommentDiff(comment)}
          <CommentThread
            anchorHeaderExtra={renderResolveIconButton(pullRequest, thread)}
            comment={comment}
            allComments={allComments}
            hideAuthor={hideAuthor}
            showPromptButton={showPromptButton}
          />
        </CardContent>
      )}
      {showContent && cardFooter && (
        <CardFooter className="px-3 pt-1! pb-2 border-t border-border flex flex-col items-stretch gap-2">
          {cardFooter}
        </CardFooter>
      )}
    </Card>
  )
}

function renderFileCardFooter(
  comment: Comment,
  pullRequest: PullRequest | undefined,
  thread: ReviewThread | null
): ReactElement | null {
  if (!pullRequest) {
    return null
  }

  return (
    <>
      {thread?.isResolved && <ResolvedBadge thread={thread} />}
      <CommentReply
        comment={comment}
        pullRequest={pullRequest}
      />
    </>
  )
}

function renderResolveIconButton(
  pullRequest: PullRequest | undefined,
  thread: ReviewThread | null
): ReactElement | null {
  if (!pullRequest || !thread) {
    return null
  }

  return (
    <ResolveThreadButton
      appearance="icon"
      pullRequest={pullRequest}
      thread={thread}
    />
  )
}

interface FileCommentHeaderProps {
  comment: Comment
  isCollapsible: boolean
  isExpanded: boolean
  isOutdated: boolean
  onToggle: () => void
}

function FileCommentHeader({
  comment,
  isCollapsible,
  isExpanded,
  isOutdated,
  onToggle
}: FileCommentHeaderProps): ReactElement {
  const inner = (
    <>
      <Code2 className="size-3.5 text-muted-foreground shrink-0" />
      <CardTitle className="min-w-0 flex-1 text-xs text-foreground/80 font-mono truncate">
        {comment.path}
      </CardTitle>
      {isOutdated && <OutdatedBadge />}
      {isCollapsible && (
        <ChevronDown
          className={cn(
            'size-4 shrink-0 text-muted-foreground transition-transform',
            isExpanded && 'rotate-180'
          )}
        />
      )}
    </>
  )

  if (isCollapsible) {
    return (
      <button
        type="button"
        aria-expanded={isExpanded}
        onClick={onToggle}
        className={cn(
          'w-full text-left',
          'px-3 py-2 flex items-center gap-2',
          'cursor-pointer hover:bg-muted/50 transition-colors',
          isExpanded && 'border-b border-border'
        )}
      >
        {inner}
      </button>
    )
  }

  return (
    <CardHeader className="px-3 py-2 pb-2! border-b border-border flex items-center gap-2">
      {inner}
    </CardHeader>
  )
}

interface InlineFooterProps {
  comment: Comment
  pullRequest: PullRequest
}

function InlineFooter({
  comment,
  pullRequest
}: InlineFooterProps): ReactElement {
  return (
    <div className="px-3.5 pt-2 pb-3">
      <CommentReply
        comment={comment}
        pullRequest={pullRequest}
      />
    </div>
  )
}
