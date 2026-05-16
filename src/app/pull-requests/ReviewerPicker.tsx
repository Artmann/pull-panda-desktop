import { Check, Plus, Search } from 'lucide-react'
import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement
} from 'react'
import { toast } from 'sonner'

import { UserAvatar } from '@/app/components/UserAvatar'
import { Badge } from '@/app/components/ui/badge'
import { Input } from '@/app/components/ui/input'
import { removeReviewers, requestReviewers } from '@/app/lib/api'
import { cn } from '@/app/lib/utils'
import { useAppDispatch, useAppSelector } from '@/app/store/hooks'
import { pullRequestsActions } from '@/app/store/pull-requests-slice'
import { recentReviewersActions } from '@/app/store/recent-reviewers-slice'
import type { PullRequest } from '@/types/pull-request'

import type { CodeownerEntry, Collaborator } from '@/app/lib/api'
import type { RecentReviewer } from '@/app/store/recent-reviewers-slice'

import {
  buildReviewerCandidates,
  type ReviewerCandidate,
  type ReviewerSection
} from './build-reviewer-candidates'
import { useReviewerSuggestionsLoader } from './use-reviewer-suggestions-loader'

const emptyRecents: RecentReviewer[] = []
const emptyCollaborators: Collaborator[] = []
const emptyCodeowners: CodeownerEntry[] = []

interface ReviewerPickerProps {
  pullRequest: PullRequest
  variant?: 'compact' | 'cta'
}

const sectionTitles: Record<ReviewerSection, string> = {
  recent: 'Recent',
  suggestion: 'Suggestions',
  'code-owner': 'Code owners',
  collaborator: 'Collaborators'
}

const sectionOrder: ReviewerSection[] = [
  'recent',
  'suggestion',
  'code-owner',
  'collaborator'
]

export const ReviewerPicker = memo(function ReviewerPicker({
  pullRequest,
  variant = 'compact'
}: ReviewerPickerProps): ReactElement {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')

  const containerRef = useRef<HTMLDivElement>(null)
  const searchInputRef = useRef<HTMLInputElement>(null)
  const dispatch = useAppDispatch()
  const repoFullName = `${pullRequest.repositoryOwner}/${pullRequest.repositoryName}`

  useReviewerSuggestionsLoader(pullRequest)

  const recents = useAppSelector(
    (state) => state.recentReviewers?.byRepo[repoFullName] ?? emptyRecents
  )

  const collaborators = useAppSelector(
    (state) =>
      state.reviewerSuggestions?.collaboratorsByRepo[repoFullName] ??
      emptyCollaborators
  )

  const codeowners = useAppSelector(
    (state) =>
      state.reviewerSuggestions?.codeownersByPullRequest[pullRequest.id] ??
      emptyCodeowners
  )

  const requestedLogins = useMemo(
    () =>
      new Set(pullRequest.requestedReviewers.map((reviewer) => reviewer.login)),
    [pullRequest.requestedReviewers]
  )

  useEffect(() => {
    if (!isOpen) {
      return
    }

    const handleClickOutside = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsOpen(false)
      }
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [isOpen])

  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => searchInputRef.current?.focus())
    } else {
      setQuery('')
    }
  }, [isOpen])

  const candidatesBySection = useMemo(() => {
    const excludeLogins = pullRequest.authorLogin
      ? new Set([pullRequest.authorLogin])
      : undefined

    const candidates = buildReviewerCandidates({
      collaborators,
      codeowners,
      excludeLogins,
      query,
      recents
    })

    const grouped = new Map<ReviewerSection, ReviewerCandidate[]>()

    for (const candidate of candidates) {
      const existing = grouped.get(candidate.section) ?? []
      existing.push(candidate)
      grouped.set(candidate.section, existing)
    }

    return grouped
  }, [collaborators, codeowners, pullRequest.authorLogin, query, recents])

  const handleToggle = useCallback(
    (candidate: ReviewerCandidate) => {
      const isRequested = requestedLogins.has(candidate.login)
      const previous = pullRequest.requestedReviewers

      const optimistic = isRequested
        ? previous.filter((reviewer) => reviewer.login !== candidate.login)
        : [
            ...previous,
            { avatarUrl: candidate.avatarUrl, login: candidate.login }
          ]

      dispatch(
        pullRequestsActions.upsertItem({
          ...pullRequest,
          requestedReviewers: optimistic
        })
      )

      if (!isRequested) {
        dispatch(
          recentReviewersActions.recordUsage({
            avatarUrl: candidate.avatarUrl,
            login: candidate.login,
            repoFullName
          })
        )
      }

      const mutation = isRequested ? removeReviewers : requestReviewers

      mutation({ logins: [candidate.login], pullRequestId: pullRequest.id })
        .then((updated) => {
          dispatch(pullRequestsActions.upsertItem(updated))
        })
        .catch((error: unknown) => {
          dispatch(
            pullRequestsActions.upsertItem({
              ...pullRequest,
              requestedReviewers: previous
            })
          )

          const message =
            error instanceof Error
              ? error.message
              : isRequested
                ? 'Failed to remove reviewer'
                : 'Failed to request reviewer'

          toast.error(message)
        })
    },
    [dispatch, pullRequest, repoFullName, requestedLogins]
  )

  const hasResults = candidatesBySection.size > 0

  return (
    <div
      className="relative"
      ref={containerRef}
    >
      {variant === 'cta' ? (
        <button
          aria-label="Assign reviewers"
          className={cn(
            'flex items-center gap-1.5',
            '-mx-1.5 px-1.5 py-0.5 rounded',
            'text-xs text-muted-foreground',
            'hover:text-foreground',
            'transition-colors cursor-pointer'
          )}
          onClick={() => setIsOpen((value) => !value)}
          type="button"
        >
          <Plus className="size-3.5" />
          Assign reviewers
        </button>
      ) : (
        <button
          aria-label="Assign reviewer"
          className={cn(
            'flex items-center justify-center',
            'size-7 rounded-full',
            'border border-dashed border-border',
            'text-muted-foreground',
            'hover:border-foreground hover:text-foreground',
            'transition-colors cursor-pointer'
          )}
          onClick={() => setIsOpen((value) => !value)}
          type="button"
        >
          <Plus className="size-3.5" />
        </button>
      )}

      {isOpen && (
        <div
          className={cn(
            'absolute top-full left-0 z-50 mt-2',
            'w-80 rounded-lg border border-border bg-popover shadow-lg',
            'overflow-hidden'
          )}
        >
          <div className="border-b border-border p-2">
            <div className="relative">
              <Search className="absolute left-2 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />

              <Input
                className="pl-7"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Assign reviewer..."
                ref={searchInputRef}
                size="sm"
                value={query}
              />
            </div>
          </div>

          <div className="max-h-80 overflow-y-auto py-1">
            {!hasResults && (
              <div className="px-3 py-6 text-center text-xs text-muted-foreground">
                No matching reviewers.
              </div>
            )}

            {sectionOrder.map((section) => {
              const options = candidatesBySection.get(section)

              if (!options || options.length === 0) {
                return null
              }

              return (
                <ReviewerSection
                  isSelected={(login) => requestedLogins.has(login)}
                  key={section}
                  onToggle={handleToggle}
                  options={options}
                  title={sectionTitles[section]}
                />
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
})

interface ReviewerSectionProps {
  isSelected: (login: string) => boolean
  onToggle: (candidate: ReviewerCandidate) => void
  options: ReviewerCandidate[]
  title: string
}

function ReviewerSection({
  isSelected,
  onToggle,
  options,
  title
}: ReviewerSectionProps): ReactElement {
  return (
    <div>
      <div className="px-3 pt-2 pb-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {title}
      </div>

      <ul>
        {options.map((option) => (
          <li key={option.login}>
            <ReviewerRow
              isSelected={isSelected(option.login)}
              onToggle={onToggle}
              option={option}
            />
          </li>
        ))}
      </ul>
    </div>
  )
}

interface ReviewerRowProps {
  isSelected: boolean
  onToggle: (candidate: ReviewerCandidate) => void
  option: ReviewerCandidate
}

function ReviewerRow({
  isSelected,
  onToggle,
  option
}: ReviewerRowProps): ReactElement {
  const ownerSubLabel =
    option.isOwner && option.ownerPatterns.length > 0
      ? `Code owner · ${option.ownerPatterns.slice(0, 2).join(', ')}`
      : option.isOwner
        ? 'Code owner'
        : null

  const subLabel = ownerSubLabel ?? option.description

  return (
    <button
      className={cn(
        'w-full flex items-center gap-2.5 px-3 py-1.5',
        'text-left text-sm',
        'hover:bg-accent hover:text-accent-foreground',
        'transition-colors cursor-pointer'
      )}
      onClick={() => onToggle(option)}
      type="button"
    >
      <UserAvatar
        avatarUrl={option.avatarUrl}
        login={option.displayName}
      />

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="truncate font-medium">{option.displayName}</span>

          {option.isOwner && (
            <Badge
              className="text-[9px] px-1.5 py-0 bg-[var(--status-success)] border-[var(--status-success-border)] text-[var(--status-success-foreground)]"
              variant="outline"
            >
              OWNER
            </Badge>
          )}
        </div>

        {subLabel && (
          <div className="truncate text-[11px] text-muted-foreground">
            {subLabel}
          </div>
        )}
      </div>

      <span
        aria-hidden
        className={cn(
          'flex items-center justify-center size-5 rounded',
          'border border-border',
          isSelected
            ? 'bg-[var(--status-success-foreground)] text-[var(--status-success)] border-transparent'
            : 'text-transparent'
        )}
      >
        <Check
          className="size-3.5"
          strokeWidth={3}
        />
      </span>
    </button>
  )
}
