import type { CheckRollup } from '@/app/components/check-rollup'
import type { PullRequest } from '@/types/pull-request'

export type FacetKey = 'authors' | 'flags' | 'repos'

export type SortId =
  | 'author'
  | 'failing'
  | 'needs'
  | 'number'
  | 'oldest'
  | 'ready'
  | 'recent'
  | 'repo'

export interface SidebarFilters {
  authors: string[]
  flags: string[]
  query: string
  repos: string[]
}

export interface FacetValue {
  count: number
  label: string
}

export interface SidebarRow {
  checkRollup: CheckRollup
  mergeReadiness: MergeReadiness
  needsAttention: boolean
  pullRequest: PullRequest
  unread: boolean
}

/** How close a pull request is to being mergeable, worst blocker first. */
export type MergeReadiness =
  | 'changes-requested'
  | 'checks-failing'
  | 'checks-running'
  | 'draft'
  | 'needs-review'
  | 'not-open'
  | 'ready'

const unknownAuthor = 'Unknown'

export const emptyFilters: SidebarFilters = {
  authors: [],
  flags: [],
  query: '',
  repos: []
}

// Order is the order they appear in the UI, not alphabetical.
const stateFlags = ['Ready', 'Draft', 'Assigned to me']

export const facets: { key: FacetKey; label: string }[] = [
  { key: 'repos', label: 'Repo' },
  { key: 'authors', label: 'Author' },
  { key: 'flags', label: 'State' }
]

export const sortOptions: { id: SortId; label: string }[] = [
  { id: 'needs', label: 'Needs attention first' },
  { id: 'ready', label: 'Ready to merge' },
  { id: 'recent', label: 'Recently updated' },
  { id: 'oldest', label: 'Oldest first' },
  { id: 'failing', label: 'Failing checks first' },
  { id: 'repo', label: 'Repo name' },
  { id: 'author', label: 'Author' },
  { id: 'number', label: 'PR number' }
]

function repositoryFullName(pullRequest: PullRequest): string {
  return `${pullRequest.repositoryOwner}/${pullRequest.repositoryName}`
}

function authorOf(pullRequest: PullRequest): string {
  return pullRequest.authorLogin ?? unknownAuthor
}

/**
 * Both timestamps are ISO 8601 in UTC — `updatedAt` comes from GitHub and
 * `lastViewedAt` from `new Date().toISOString()` — so a string compare is a
 * chronological compare.
 */
export function isUnread(pullRequest: PullRequest): boolean {
  if (pullRequest.lastViewedAt === null) {
    return true
  }

  return pullRequest.updatedAt > pullRequest.lastViewedAt
}

/**
 * Someone else's pull request needs attention when you are on the hook to
 * review it. Your own needs attention when it is blocked on you.
 */
export function needsAttention(
  pullRequest: PullRequest,
  checkRollup: CheckRollup
): boolean {
  if (pullRequest.state !== 'OPEN' || pullRequest.isDraft) {
    return false
  }

  if (pullRequest.isAuthor) {
    return pullRequest.changesRequestedCount > 0 || checkRollup === 'failing'
  }

  return pullRequest.isReviewer
}

// Ordered best to worst. The sort ranks by this, so a pull request that is
// merely waiting on a review outranks one that is failing or still a draft.
const mergeReadinessOrder: MergeReadiness[] = [
  'ready',
  'needs-review',
  'checks-running',
  'checks-failing',
  'changes-requested',
  'draft',
  'not-open'
]

const mergeReadinessRanks = new Map<MergeReadiness, number>(
  mergeReadinessOrder.map((readiness, index) => [readiness, index])
)

/**
 * A best guess from the data the sidebar has for every row. The authoritative
 * answer lives in `state.mergeOptions`, but that is only fetched for a pull
 * request once you open it, so it cannot drive a sort over the whole list.
 *
 * Returns the single worst thing standing between the pull request and a
 * merge, so the sort degrades to "closest to mergeable" rather than to
 * "recently updated" when nothing is outright ready.
 */
export function getMergeReadiness(
  pullRequest: PullRequest,
  checkRollup: CheckRollup
): MergeReadiness {
  if (pullRequest.state !== 'OPEN') {
    return 'not-open'
  }

  if (pullRequest.isDraft) {
    return 'draft'
  }

  if (pullRequest.changesRequestedCount > 0) {
    return 'changes-requested'
  }

  if (checkRollup === 'failing') {
    return 'checks-failing'
  }

  if (checkRollup === 'running') {
    return 'checks-running'
  }

  if (pullRequest.approvalCount === 0) {
    return 'needs-review'
  }

  return 'ready'
}

export function buildRows(
  pullRequests: readonly PullRequest[],
  checkRollups: ReadonlyMap<string, CheckRollup>
): SidebarRow[] {
  return pullRequests.map((pullRequest) => {
    const checkRollup = checkRollups.get(pullRequest.id) ?? 'none'

    return {
      checkRollup,
      mergeReadiness: getMergeReadiness(pullRequest, checkRollup),
      needsAttention: needsAttention(pullRequest, checkRollup),
      pullRequest,
      unread: isUnread(pullRequest)
    }
  })
}

function matchesQuery(pullRequest: PullRequest, query: string): boolean {
  const haystack = [
    pullRequest.title,
    repositoryFullName(pullRequest),
    authorOf(pullRequest),
    `#${pullRequest.number.toString()}`
  ]
    .join(' ')
    .toLowerCase()

  return haystack.includes(query)
}

function matchesFlags(pullRequest: PullRequest, flags: string[]): boolean {
  if (flags.includes('Assigned to me') && !pullRequest.isAssignee) {
    return false
  }

  const wantsReady = flags.includes('Ready')
  const wantsDraft = flags.includes('Draft')

  // Selecting both Ready and Draft reads as "either", so it filters nothing.
  if (wantsReady === wantsDraft) {
    return true
  }

  return wantsReady ? !pullRequest.isDraft : pullRequest.isDraft
}

export function filterRows(
  rows: readonly SidebarRow[],
  filters: SidebarFilters
): SidebarRow[] {
  const query = filters.query.trim().toLowerCase()

  return rows.filter(({ pullRequest }) => {
    if (query.length > 0 && !matchesQuery(pullRequest, query)) {
      return false
    }

    if (
      filters.repos.length > 0 &&
      !filters.repos.includes(repositoryFullName(pullRequest))
    ) {
      return false
    }

    if (
      filters.authors.length > 0 &&
      !filters.authors.includes(authorOf(pullRequest))
    ) {
      return false
    }

    return matchesFlags(pullRequest, filters.flags)
  })
}

const byRecent = (a: SidebarRow, b: SidebarRow): number =>
  b.pullRequest.updatedAt.localeCompare(a.pullRequest.updatedAt)

const comparators: Record<SortId, (a: SidebarRow, b: SidebarRow) => number> = {
  author: (a, b) =>
    authorOf(a.pullRequest).localeCompare(authorOf(b.pullRequest)) ||
    byRecent(a, b),

  failing: (a, b) =>
    Number(b.checkRollup === 'failing') - Number(a.checkRollup === 'failing') ||
    byRecent(a, b),

  needs: (a, b) =>
    Number(b.needsAttention) - Number(a.needsAttention) || byRecent(a, b),

  number: (a, b) => b.pullRequest.number - a.pullRequest.number,

  ready: (a, b) =>
    (mergeReadinessRanks.get(a.mergeReadiness) ?? 0) -
      (mergeReadinessRanks.get(b.mergeReadiness) ?? 0) || byRecent(a, b),

  oldest: (a, b) =>
    a.pullRequest.updatedAt.localeCompare(b.pullRequest.updatedAt),

  recent: byRecent,

  repo: (a, b) =>
    repositoryFullName(a.pullRequest).localeCompare(
      repositoryFullName(b.pullRequest)
    ) || a.pullRequest.number - b.pullRequest.number
}

export function sortRows(
  rows: readonly SidebarRow[],
  sort: SortId
): SidebarRow[] {
  return [...rows].sort(comparators[sort])
}

export function buildFacetValues(
  rows: readonly SidebarRow[],
  key: FacetKey
): FacetValue[] {
  if (key === 'flags') {
    const counts: Record<string, number> = {
      'Assigned to me': rows.filter((row) => row.pullRequest.isAssignee).length,
      Draft: rows.filter((row) => row.pullRequest.isDraft).length,
      Ready: rows.filter((row) => !row.pullRequest.isDraft).length
    }

    return stateFlags.map((label) => ({ count: counts[label], label }))
  }

  const valueOf =
    key === 'repos'
      ? (pullRequest: PullRequest) => repositoryFullName(pullRequest)
      : authorOf

  const counts = new Map<string, number>()

  for (const { pullRequest } of rows) {
    const value = valueOf(pullRequest)

    counts.set(value, (counts.get(value) ?? 0) + 1)
  }

  return [...counts.entries()]
    .map(([label, count]) => ({ count, label }))
    .sort((a, b) => a.label.localeCompare(b.label))
}

/**
 * The index to move to when stepping through the list by keyboard. Returns
 * `undefined` when there is nowhere to go. With nothing selected yet, stepping
 * forwards enters at the top and backwards enters at the bottom.
 */
export function stepIndex(
  rows: readonly SidebarRow[],
  selectedId: string | undefined,
  offset: number
): number | undefined {
  if (rows.length === 0) {
    return
  }

  const current = rows.findIndex((row) => row.pullRequest.id === selectedId)

  if (current === -1) {
    return offset > 0 ? 0 : rows.length - 1
  }

  return Math.min(rows.length - 1, Math.max(0, current + offset))
}

export function hasActiveFilters(filters: SidebarFilters): boolean {
  return filters.query.trim().length > 0 || countActiveFilters(filters) > 0
}

export function countActiveFilters(filters: SidebarFilters): number {
  return filters.authors.length + filters.flags.length + filters.repos.length
}

export function countLabel(count: number): string {
  return `${count.toString()} ${count === 1 ? 'pull request' : 'pull requests'}`
}

export function toggleFilterValue(
  filters: SidebarFilters,
  key: FacetKey,
  value: string
): SidebarFilters {
  const current = filters[key]

  return {
    ...filters,
    [key]: current.includes(value)
      ? current.filter((entry) => entry !== value)
      : [...current, value]
  }
}
