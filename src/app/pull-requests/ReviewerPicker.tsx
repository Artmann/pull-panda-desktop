import { Check, Plus, Search } from 'lucide-react'
import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactElement,
  type RefObject
} from 'react'

import { UserAvatar } from '@/app/components/UserAvatar'
import { Badge } from '@/app/components/ui/badge'
import { Input } from '@/app/components/ui/input'
import { cn } from '@/app/lib/utils'
import type { PullRequest } from '@/types/pull-request'

import type {
  ReviewerCandidate,
  ReviewerSection
} from './build-reviewer-candidates'
import {
  useDismissOnOutsideClick,
  useReviewerCandidates,
  useToggleReviewer
} from './use-reviewer-picker'
import { useReviewerSuggestionsLoader } from './use-reviewer-suggestions-loader'

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

  useReviewerSuggestionsLoader(pullRequest)

  const requestedLogins = useMemo(
    () =>
      new Set(pullRequest.requestedReviewers.map((reviewer) => reviewer.login)),
    [pullRequest.requestedReviewers]
  )

  const close = useCallback(() => setIsOpen(false), [])

  useDismissOnOutsideClick(containerRef, isOpen, close)

  useEffect(() => {
    if (isOpen) {
      requestAnimationFrame(() => searchInputRef.current?.focus())
    } else {
      setQuery('')
    }
  }, [isOpen])

  const candidatesBySection = useReviewerCandidates(pullRequest, query)
  const handleToggle = useToggleReviewer(pullRequest, requestedLogins)

  const toggleOpen = () => setIsOpen((value) => !value)

  return (
    <div
      className="relative"
      ref={containerRef}
    >
      <ReviewerPickerTrigger
        onClick={toggleOpen}
        variant={variant}
      />

      {isOpen && (
        <ReviewerPickerMenu
          candidatesBySection={candidatesBySection}
          onQueryChange={setQuery}
          onToggle={handleToggle}
          query={query}
          requestedLogins={requestedLogins}
          searchInputRef={searchInputRef}
        />
      )}
    </div>
  )
})

interface ReviewerPickerTriggerProps {
  onClick: () => void
  variant: 'compact' | 'cta'
}

function ReviewerPickerTrigger({
  onClick,
  variant
}: ReviewerPickerTriggerProps): ReactElement {
  if (variant === 'cta') {
    return (
      <button
        aria-label="Assign reviewers"
        className={cn(
          'flex items-center gap-1.5',
          '-mx-1.5 px-1.5 py-0.5 rounded',
          'text-xs text-muted-foreground',
          'hover:text-foreground',
          'transition-colors cursor-pointer'
        )}
        onClick={onClick}
        type="button"
      >
        <Plus className="size-3.5" />
        Assign reviewers
      </button>
    )
  }

  return (
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
      onClick={onClick}
      type="button"
    >
      <Plus className="size-3.5" />
    </button>
  )
}

interface ReviewerPickerMenuProps {
  candidatesBySection: Map<ReviewerSection, ReviewerCandidate[]>
  onQueryChange: (query: string) => void
  onToggle: (candidate: ReviewerCandidate) => void
  query: string
  requestedLogins: Set<string>
  searchInputRef: RefObject<HTMLInputElement | null>
}

function ReviewerPickerMenu({
  candidatesBySection,
  onQueryChange,
  onToggle,
  query,
  requestedLogins,
  searchInputRef
}: ReviewerPickerMenuProps): ReactElement {
  const hasResults = candidatesBySection.size > 0

  return (
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
            onChange={(event) => onQueryChange(event.target.value)}
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
              onToggle={onToggle}
              options={options}
              title={sectionTitles[section]}
            />
          )
        })}
      </div>
    </div>
  )
}

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
      <div className="px-3 pt-2 pb-1 text-2xs font-semibold uppercase tracking-wider text-muted-foreground">
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
              className="text-2xs px-1.5 py-0 bg-status-success border-status-success-border text-status-success-foreground"
              variant="outline"
            >
              OWNER
            </Badge>
          )}
        </div>

        {subLabel && (
          <div className="truncate text-xs text-muted-foreground">
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
