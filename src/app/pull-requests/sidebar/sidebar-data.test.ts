import { describe, expect, it } from 'vitest'

import type { CheckRollup } from '@/app/components/check-rollup'
import type { PullRequest } from '@/types/pull-request'

import { createMockPullRequest } from '../__test-helpers__/pull-request-fixtures'
import {
  buildFacetValues,
  buildRows,
  countActiveFilters,
  countLabel,
  emptyFilters,
  filterRows,
  hasActiveFilters,
  getMergeReadiness,
  isUnread,
  needsAttention,
  sortRows,
  stepIndex,
  toggleFilterValue,
  type SidebarRow
} from './sidebar-data'

function rowOf(
  overrides: Partial<PullRequest>,
  checkRollup: CheckRollup = 'passing'
): SidebarRow {
  const pullRequest = createMockPullRequest(overrides)

  return {
    checkRollup,
    needsAttention: needsAttention(pullRequest, checkRollup),
    pullRequest,
    mergeReadiness: getMergeReadiness(pullRequest, checkRollup),
    unread: isUnread(pullRequest)
  }
}

const titlesOf = (rows: SidebarRow[]): string[] =>
  rows.map((row) => row.pullRequest.title)

describe('isUnread', () => {
  it('treats a pull request that was never opened as unread', () => {
    expect(isUnread(createMockPullRequest({ lastViewedAt: null }))).toEqual(
      true
    )
  })

  it('is unread when it changed after it was last viewed', () => {
    const pullRequest = createMockPullRequest({
      lastViewedAt: '2024-01-01T00:00:00Z',
      updatedAt: '2024-01-02T00:00:00Z'
    })

    expect(isUnread(pullRequest)).toEqual(true)
  })

  it('is read when it has not changed since it was last viewed', () => {
    const pullRequest = createMockPullRequest({
      lastViewedAt: '2024-01-02T00:00:00Z',
      updatedAt: '2024-01-01T00:00:00Z'
    })

    expect(isUnread(pullRequest)).toEqual(false)
  })
})

describe('needsAttention', () => {
  it('flags a pull request you were asked to review', () => {
    const pullRequest = createMockPullRequest({
      isAuthor: false,
      isReviewer: true
    })

    expect(needsAttention(pullRequest, 'passing')).toEqual(true)
  })

  it('ignores someone else’s pull request you are not reviewing', () => {
    const pullRequest = createMockPullRequest({
      isAuthor: false,
      isReviewer: false
    })

    expect(needsAttention(pullRequest, 'passing')).toEqual(false)
  })

  it('flags your own pull request when changes were requested', () => {
    const pullRequest = createMockPullRequest({
      changesRequestedCount: 1,
      isAuthor: true
    })

    expect(needsAttention(pullRequest, 'passing')).toEqual(true)
  })

  it('flags your own pull request when checks are failing', () => {
    const pullRequest = createMockPullRequest({ isAuthor: true })

    expect(needsAttention(pullRequest, 'failing')).toEqual(true)
  })

  it('leaves your own healthy pull request alone', () => {
    const pullRequest = createMockPullRequest({ isAuthor: true })

    expect(needsAttention(pullRequest, 'passing')).toEqual(false)
  })

  it('never flags drafts or closed pull requests', () => {
    expect(
      needsAttention(
        createMockPullRequest({ isDraft: true, isReviewer: true }),
        'failing'
      )
    ).toEqual(false)

    expect(
      needsAttention(
        createMockPullRequest({ isReviewer: true, state: 'MERGED' }),
        'failing'
      )
    ).toEqual(false)
  })
})

describe('buildRows', () => {
  it('decorates each pull request with its rollup, attention and unread state', () => {
    const pullRequest = createMockPullRequest({
      id: 'pr-1',
      isAuthor: false,
      isReviewer: true,
      lastViewedAt: null
    })

    expect(buildRows([pullRequest], new Map([['pr-1', 'failing']]))).toEqual([
      {
        checkRollup: 'failing',
        mergeReadiness: 'checks-failing',
        needsAttention: true,
        pullRequest,
        unread: true
      }
    ])
  })

  it('falls back to no checks when the pull request has none', () => {
    const pullRequest = createMockPullRequest({ id: 'pr-1' })

    expect(buildRows([pullRequest], new Map())[0].checkRollup).toEqual('none')
  })
})

describe('filterRows', () => {
  const rows = [
    rowOf({ id: 'a', repositoryName: 'alpha', title: 'Fix the header' }),
    rowOf({
      authorLogin: 'octocat',
      id: 'b',
      repositoryName: 'beta',
      title: 'Add tests'
    }),
    rowOf({ id: 'c', isDraft: true, repositoryName: 'alpha', title: 'Spike' }),
    rowOf({ id: 'd', isAssignee: true, repositoryName: 'beta', title: 'Chore' })
  ]

  it('returns everything when nothing is set', () => {
    expect(filterRows(rows, emptyFilters)).toHaveLength(4)
  })

  it('matches the query against title, repo, author and number', () => {
    expect(
      titlesOf(filterRows(rows, { ...emptyFilters, query: 'header' }))
    ).toEqual(['Fix the header'])

    expect(
      titlesOf(filterRows(rows, { ...emptyFilters, query: 'octocat' }))
    ).toEqual(['Add tests'])

    expect(filterRows(rows, { ...emptyFilters, query: '#42' })).toHaveLength(4)
  })

  it('filters by repository', () => {
    expect(
      titlesOf(filterRows(rows, { ...emptyFilters, repos: ['owner/beta'] }))
    ).toEqual(['Add tests', 'Chore'])
  })

  it('filters by author', () => {
    expect(
      titlesOf(filterRows(rows, { ...emptyFilters, authors: ['octocat'] }))
    ).toEqual(['Add tests'])
  })

  it('filters drafts in and out', () => {
    expect(
      titlesOf(filterRows(rows, { ...emptyFilters, flags: ['Draft'] }))
    ).toEqual(['Spike'])

    expect(
      titlesOf(filterRows(rows, { ...emptyFilters, flags: ['Ready'] }))
    ).toEqual(['Fix the header', 'Add tests', 'Chore'])
  })

  it('treats Ready plus Draft as either, not neither', () => {
    expect(
      filterRows(rows, { ...emptyFilters, flags: ['Draft', 'Ready'] })
    ).toHaveLength(4)
  })

  it('filters by assignment', () => {
    expect(
      titlesOf(filterRows(rows, { ...emptyFilters, flags: ['Assigned to me'] }))
    ).toEqual(['Chore'])
  })

  it('combines filters', () => {
    expect(
      filterRows(rows, {
        ...emptyFilters,
        flags: ['Ready'],
        repos: ['owner/alpha']
      })
    ).toHaveLength(1)
  })
})

describe('sortRows', () => {
  // Deliberately arranged so that no two sorts produce the same order.
  const rows = [
    rowOf({
      authorLogin: 'zoe',
      id: 'a',
      number: 9,
      repositoryName: 'mike-repo',
      title: 'Oldest',
      updatedAt: '2024-01-01T00:00:00Z'
    }),
    rowOf(
      {
        authorLogin: 'mike',
        id: 'b',
        isAuthor: true,
        number: 5,
        repositoryName: 'zulu',
        title: 'Failing',
        updatedAt: '2024-01-02T00:00:00Z'
      },
      'failing'
    ),
    rowOf({
      authorLogin: 'alice',
      id: 'c',
      number: 1,
      repositoryName: 'alpha',
      title: 'Newest',
      updatedAt: '2024-01-03T00:00:00Z'
    })
  ]

  it('puts what needs attention first, then the most recent', () => {
    expect(titlesOf(sortRows(rows, 'needs'))).toEqual([
      'Failing',
      'Newest',
      'Oldest'
    ])
  })

  it('sorts by most recently updated', () => {
    expect(titlesOf(sortRows(rows, 'recent'))).toEqual([
      'Newest',
      'Failing',
      'Oldest'
    ])
  })

  it('sorts by oldest first', () => {
    expect(titlesOf(sortRows(rows, 'oldest'))).toEqual([
      'Oldest',
      'Failing',
      'Newest'
    ])
  })

  it('puts failing checks first, then the most recent', () => {
    expect(titlesOf(sortRows(rows, 'failing'))).toEqual([
      'Failing',
      'Newest',
      'Oldest'
    ])
  })

  it('sorts by repository name', () => {
    expect(titlesOf(sortRows(rows, 'repo'))).toEqual([
      'Newest',
      'Oldest',
      'Failing'
    ])
  })

  it('sorts by author', () => {
    expect(titlesOf(sortRows(rows, 'author'))).toEqual([
      'Newest',
      'Failing',
      'Oldest'
    ])
  })

  it('sorts by descending pull request number', () => {
    expect(titlesOf(sortRows(rows, 'number'))).toEqual([
      'Oldest',
      'Failing',
      'Newest'
    ])
  })

  it('does not mutate the input', () => {
    const input = [...rows]

    sortRows(input, 'number')

    expect(titlesOf(input)).toEqual(['Oldest', 'Failing', 'Newest'])
  })
})

describe('buildFacetValues', () => {
  const rows = [
    rowOf({ id: 'a', repositoryName: 'beta' }),
    rowOf({ authorLogin: 'octocat', id: 'b', repositoryName: 'alpha' }),
    rowOf({ authorLogin: null, id: 'c', isDraft: true, repositoryName: 'beta' })
  ]

  it('counts repositories alphabetically by full name', () => {
    expect(buildFacetValues(rows, 'repos')).toEqual([
      { count: 1, label: 'owner/alpha' },
      { count: 2, label: 'owner/beta' }
    ])
  })

  it('counts authors and names the missing one', () => {
    expect(buildFacetValues(rows, 'authors')).toEqual([
      { count: 1, label: 'octocat' },
      { count: 1, label: 'testuser' },
      { count: 1, label: 'Unknown' }
    ])
  })

  it('counts the state flags in display order', () => {
    expect(buildFacetValues(rows, 'flags')).toEqual([
      { count: 2, label: 'Ready' },
      { count: 1, label: 'Draft' },
      { count: 0, label: 'Assigned to me' }
    ])
  })
})

describe('filter bookkeeping', () => {
  it('counts active filters but not the query', () => {
    expect(
      countActiveFilters({
        authors: ['octocat'],
        flags: ['Draft'],
        query: 'anything',
        repos: ['owner/alpha', 'owner/beta']
      })
    ).toEqual(4)
  })

  it('pluralizes the count label', () => {
    expect([countLabel(0), countLabel(1), countLabel(2)]).toEqual([
      '0 pull requests',
      '1 pull request',
      '2 pull requests'
    ])
  })

  it('toggles a value on and back off', () => {
    const added = toggleFilterValue(emptyFilters, 'repos', 'owner/alpha')

    expect(added).toEqual({
      authors: [],
      flags: [],
      query: '',
      repos: ['owner/alpha']
    })

    expect(toggleFilterValue(added, 'repos', 'owner/alpha')).toEqual(
      emptyFilters
    )
  })
})

describe('stepIndex', () => {
  const rows = [
    rowOf({ id: 'a', title: 'First' }),
    rowOf({ id: 'b', title: 'Second' }),
    rowOf({ id: 'c', title: 'Third' })
  ]

  it('has nowhere to go in an empty list', () => {
    expect(stepIndex([], undefined, 1)).toEqual(undefined)
    expect(stepIndex([], 'a', -1)).toEqual(undefined)
  })

  it('enters at the top when stepping forwards with nothing selected', () => {
    expect(stepIndex(rows, undefined, 1)).toEqual(0)
  })

  it('enters at the bottom when stepping backwards with nothing selected', () => {
    expect(stepIndex(rows, undefined, -1)).toEqual(2)
  })

  it('enters from the end when the selected row is not in the list', () => {
    expect(stepIndex(rows, 'not-here', 1)).toEqual(0)
  })

  it('moves one row at a time', () => {
    expect(stepIndex(rows, 'b', 1)).toEqual(2)
    expect(stepIndex(rows, 'b', -1)).toEqual(0)
  })

  it('stops at the ends rather than wrapping', () => {
    expect(stepIndex(rows, 'c', 1)).toEqual(2)
    expect(stepIndex(rows, 'a', -1)).toEqual(0)
  })
})

describe('hasActiveFilters', () => {
  it('is false for the empty filters', () => {
    expect(hasActiveFilters(emptyFilters)).toEqual(false)
  })

  it('ignores a query that is only whitespace', () => {
    expect(hasActiveFilters({ ...emptyFilters, query: '   ' })).toEqual(false)
  })

  it('counts a query', () => {
    expect(hasActiveFilters({ ...emptyFilters, query: 'tests' })).toEqual(true)
  })

  it('counts a facet selection', () => {
    expect(hasActiveFilters({ ...emptyFilters, flags: ['Draft'] })).toEqual(
      true
    )
  })
})

describe('getMergeReadiness', () => {
  const approved = { approvalCount: 1 }

  it('is ready when approved, unblocked and checks are green', () => {
    expect(
      getMergeReadiness(createMockPullRequest(approved), 'passing')
    ).toEqual('ready')
  })

  it('is ready when there are no checks at all', () => {
    expect(getMergeReadiness(createMockPullRequest(approved), 'none')).toEqual(
      'ready'
    )
  })

  it('only needs a review when everything else is green', () => {
    expect(getMergeReadiness(createMockPullRequest(), 'passing')).toEqual(
      'needs-review'
    )
  })

  it('reports the worst blocker, worst first', () => {
    expect([
      getMergeReadiness(createMockPullRequest(approved), 'running'),
      getMergeReadiness(createMockPullRequest(approved), 'failing'),
      getMergeReadiness(
        createMockPullRequest({ ...approved, changesRequestedCount: 1 }),
        'failing'
      ),
      getMergeReadiness(
        createMockPullRequest({
          ...approved,
          changesRequestedCount: 1,
          isDraft: true
        }),
        'failing'
      ),
      getMergeReadiness(
        createMockPullRequest({ ...approved, state: 'MERGED' }),
        'passing'
      )
    ]).toEqual([
      'checks-running',
      'checks-failing',
      'changes-requested',
      'draft',
      'not-open'
    ])
  })
})

describe('sortRows ready to merge', () => {
  it('ranks by how close each pull request is to merging', () => {
    const rows = [
      rowOf({ id: 'a', isDraft: true, title: 'Draft' }),
      rowOf({ approvalCount: 1, id: 'b', title: 'Mergeable' }),
      rowOf({ changesRequestedCount: 1, id: 'c', title: 'Changes requested' }),
      rowOf({ id: 'd', title: 'Failing' }, 'failing'),
      rowOf({ id: 'e', title: 'Awaiting review' })
    ]

    expect(titlesOf(sortRows(rows, 'ready'))).toEqual([
      'Mergeable',
      'Awaiting review',
      'Failing',
      'Changes requested',
      'Draft'
    ])
  })

  it('never puts a failing draft above a pull request that only needs a review', () => {
    const rows = [
      rowOf(
        {
          id: 'a',
          isDraft: true,
          title: 'Failing draft',
          updatedAt: '2024-09-01T00:00:00Z'
        },
        'failing'
      ),
      rowOf({
        id: 'b',
        title: 'Awaiting review',
        updatedAt: '2024-01-01T00:00:00Z'
      })
    ]

    expect(titlesOf(sortRows(rows, 'ready'))).toEqual([
      'Awaiting review',
      'Failing draft'
    ])
  })

  it('falls back to the most recent within a tier', () => {
    const rows = [
      rowOf({ id: 'a', title: 'Older', updatedAt: '2024-01-01T00:00:00Z' }),
      rowOf({ id: 'b', title: 'Newer', updatedAt: '2024-01-02T00:00:00Z' })
    ]

    expect(titlesOf(sortRows(rows, 'ready'))).toEqual(['Newer', 'Older'])
  })
})
