/**
 * @vitest-environment jsdom
 */
import { configureStore } from '@reduxjs/toolkit'
import { act, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { afterEach, describe, expect, it, vi } from 'vitest'

// Pin the platform so the jump modifier is Meta rather than whatever jsdom's
// navigator.platform happens to report.
vi.mock('@/app/commands/utils', () => ({
  isMac: () => true
}))

import { getSidebarNavigation } from '@/app/commands/sidebar-accessor'
import checksReducer from '@/app/store/checks-slice'
import pullRequestsReducer, {
  pullRequestsActions
} from '@/app/store/pull-requests-slice'
import type { Check } from '@/types/pull-request-details'
import type { PullRequest } from '@/types/pull-request'

import { createMockPullRequest } from '../__test-helpers__/pull-request-fixtures'
import { PullRequestNavigationProvider } from '../PullRequestNavigationProvider'
import { PullRequestSidebar } from './PullRequestSidebar'
import { departureDurationMs } from './use-departing-rows'

import { TooltipProvider } from '@/app/components/ui/tooltip'

const pullRequests: PullRequest[] = [
  createMockPullRequest({
    authorLogin: 'octocat',
    id: 'pr-a',
    isAuthor: false,
    isReviewer: true,
    lastViewedAt: null,
    number: 1,
    repositoryName: 'alpha',
    title: 'Needs your review',
    updatedAt: '2024-01-03T00:00:00Z'
  }),
  createMockPullRequest({
    authorLogin: 'artmann',
    id: 'pr-b',
    isAuthor: true,
    lastViewedAt: '2024-02-01T00:00:00Z',
    number: 2,
    repositoryName: 'beta',
    title: 'Your own work',
    updatedAt: '2024-01-02T00:00:00Z'
  }),
  createMockPullRequest({
    authorLogin: 'artmann',
    id: 'pr-c',
    isAuthor: true,
    isDraft: true,
    lastViewedAt: '2024-02-01T00:00:00Z',
    number: 3,
    repositoryName: 'beta',
    title: 'A rough draft',
    updatedAt: '2024-01-01T00:00:00Z'
  }),
  createMockPullRequest({
    id: 'pr-merged',
    lastViewedAt: '2024-02-01T00:00:00Z',
    number: 4,
    state: 'MERGED',
    title: 'Already merged',
    updatedAt: '2024-01-04T00:00:00Z'
  })
]

function LocationProbe() {
  const location = useLocation()

  return <div data-testid="pathname">{location.pathname + location.search}</div>
}

function renderSidebar({
  checks = [] as Check[],
  initialPath = '/',
  items = pullRequests
} = {}) {
  const store = configureStore({
    reducer: { checks: checksReducer, pullRequests: pullRequestsReducer },
    preloadedState: {
      checks: { items: checks },
      pullRequests: { initialized: true, items }
    }
  })

  return {
    store,
    ...render(
      <Provider store={store}>
        <TooltipProvider>
          <MemoryRouter initialEntries={[initialPath]}>
            <PullRequestNavigationProvider>
              <PullRequestSidebar />
              <LocationProbe />
              <Routes>
                <Route
                  element={null}
                  path="*"
                />
              </Routes>
            </PullRequestNavigationProvider>
          </MemoryRouter>
        </TooltipProvider>
      </Provider>
    )
  }
}

const sidebar = () =>
  screen.getByRole('complementary', { name: 'Pull requests' })

const rowTitles = (): string[] =>
  within(sidebar())
    .getAllByRole('button')
    .map((button) => button.textContent ?? '')
    .filter((text) => text.includes('#'))
    .map((text) => text)

/** The positioned wrapper the fade is applied to. */
const rowWrapper = (title: string): HTMLElement | null =>
  within(sidebar()).getByText(title).closest('[data-index]')

const merge = (store: { dispatch: (action: unknown) => unknown }, id: string) =>
  act(() => {
    const pullRequest = pullRequests.find((item) => item.id === id)

    if (!pullRequest) {
      throw new Error(`No fixture for ${id}`)
    }

    store.dispatch(
      pullRequestsActions.upsertItem({
        ...pullRequest,
        mergedAt: '2024-06-01T00:00:00Z',
        state: 'MERGED',
        // The merge response carries a fresh timestamp, which is what would
        // re-sort the row if it were not pinned while it fades.
        updatedAt: '2024-06-01T00:00:00Z'
      })
    )
  })

describe('PullRequestSidebar', () => {
  it('lists open pull requests, newest attention first, and hides merged ones', () => {
    renderSidebar()

    expect(within(sidebar()).getByText('Needs your review')).toBeInTheDocument()
    expect(within(sidebar()).getByText('Your own work')).toBeInTheDocument()
    expect(within(sidebar()).getByText('A rough draft')).toBeInTheDocument()
    expect(
      within(sidebar()).queryByText('Already merged')
    ).not.toBeInTheDocument()

    expect(within(sidebar()).getByText('3 pull requests')).toBeInTheDocument()
  })

  it('navigates to a pull request when its row is clicked', async () => {
    const user = userEvent.setup()

    renderSidebar()

    await user.click(within(sidebar()).getByText('Your own work'))

    expect(screen.getByTestId('pathname')).toHaveTextContent(
      '/pull-requests/pr-b'
    )
  })

  it('keeps the tab you are on when moving to another pull request', async () => {
    const user = userEvent.setup()

    renderSidebar({ initialPath: '/pull-requests/pr-a?tab=files' })

    await user.click(within(sidebar()).getByText('Your own work'))

    expect(screen.getByTestId('pathname')).toHaveTextContent(
      '/pull-requests/pr-b?tab=files'
    )
  })

  it('opens on the default tab when none is active', async () => {
    const user = userEvent.setup()

    renderSidebar({ initialPath: '/' })

    await user.click(within(sidebar()).getByText('Your own work'))

    expect(screen.getByTestId('pathname')).toHaveTextContent(
      '/pull-requests/pr-b'
    )
    expect(screen.getByTestId('pathname')).not.toHaveTextContent('tab=')
  })

  it('marks the open pull request as the current row', () => {
    renderSidebar({ initialPath: '/pull-requests/pr-b' })

    const current = within(sidebar())
      .getAllByRole('button')
      .filter((button) => button.getAttribute('aria-current') === 'true')

    expect(current).toHaveLength(1)
    expect(current[0]).toHaveTextContent('Your own work')
  })

  it('narrows the list as you search', async () => {
    const user = userEvent.setup()

    renderSidebar()

    await user.type(
      screen.getByPlaceholderText('Search pull requests'),
      'draft'
    )

    expect(rowTitles()).toHaveLength(1)
    expect(within(sidebar()).getByText('A rough draft')).toBeInTheDocument()
    expect(within(sidebar()).getByText('1 pull request')).toBeInTheDocument()
  })

  it('offers a way back when a search matches nothing', async () => {
    const user = userEvent.setup()

    renderSidebar()

    await user.type(
      screen.getByPlaceholderText('Search pull requests'),
      'nothing matches this'
    )

    expect(
      within(sidebar()).getByText('No pull requests match')
    ).toBeInTheDocument()

    await user.click(
      within(sidebar()).getByRole('button', { name: 'Clear filters' })
    )

    expect(within(sidebar()).getByText('3 pull requests')).toBeInTheDocument()
  })

  it('says the list is empty rather than filtered when there is nothing to show', () => {
    renderSidebar({ items: [] })

    expect(
      within(sidebar()).getByText('No open pull requests')
    ).toBeInTheDocument()
    expect(
      within(sidebar()).queryByRole('button', { name: 'Clear filters' })
    ).not.toBeInTheDocument()
  })

  it('virtualizes long lists instead of rendering every row', () => {
    const many = Array.from({ length: 500 }, (_, index) =>
      createMockPullRequest({
        id: `pr-${index.toString()}`,
        number: index,
        title: `Pull request ${index.toString()}`
      })
    )

    renderSidebar({ items: many })

    // The count reflects the whole list...
    expect(within(sidebar()).getByText('500 pull requests')).toBeInTheDocument()

    // ...but only a screenful plus overscan is in the DOM.
    const rendered = within(sidebar())
      .getAllByRole('button')
      .filter((button) => (button.textContent ?? '').includes('#'))

    expect(rendered.length).toBeLessThan(60)
    expect(rendered.length).toBeGreaterThan(0)

    // The scroll container is sized for the full list so the scrollbar is right.
    const spacer = sidebar().querySelector('.overflow-y-auto > div')

    expect(spacer?.getAttribute('style')).toContain('height:')
  })

  it('jumps to a row by index, following the current order', () => {
    renderSidebar()

    // Default sort is needs-attention first, so index 0 is the review request.
    act(() => {
      getSidebarNavigation()?.selectIndex(0)
    })

    expect(screen.getByTestId('pathname')).toHaveTextContent(
      '/pull-requests/pr-a'
    )

    act(() => {
      getSidebarNavigation()?.selectIndex(2)
    })

    expect(screen.getByTestId('pathname')).toHaveTextContent(
      '/pull-requests/pr-c'
    )
  })

  it('ignores an index past the end of the list', () => {
    renderSidebar({ initialPath: '/pull-requests/pr-b' })

    act(() => {
      getSidebarNavigation()?.selectIndex(99)
    })

    expect(screen.getByTestId('pathname')).toHaveTextContent(
      '/pull-requests/pr-b'
    )
  })

  it('shows a jump badge on each row while the modifier is held', () => {
    renderSidebar()

    expect(within(sidebar()).queryByText('⌘1')).not.toBeInTheDocument()

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Meta' }))
    })

    const badge = within(sidebar()).getByText('⌘1')

    expect(badge).toBeInTheDocument()
    expect(within(sidebar()).getByText('⌘3')).toBeInTheDocument()

    // The modifier and the digit share one badge, and it is painted over the
    // timestamp from out of flow so that holding the modifier cannot reflow
    // the rows. jsdom has no layout to measure, so the positioning that buys
    // that is what this asserts.
    expect(badge).toHaveClass('absolute')

    act(() => {
      window.dispatchEvent(new Event('blur'))
    })

    expect(within(sidebar()).queryByText('⌘1')).not.toBeInTheDocument()
  })

  it('filters by repository through the filter popover', async () => {
    const user = userEvent.setup()

    renderSidebar()

    await user.click(
      screen.getByRole('button', { name: 'Filter pull requests' })
    )

    await user.click(await screen.findByText('owner/beta'))

    expect(within(sidebar()).getByText('2 pull requests')).toBeInTheDocument()
    expect(
      within(sidebar()).queryByText('Needs your review')
    ).not.toBeInTheDocument()
  })

  it('reorders the list from the sort menu', async () => {
    const user = userEvent.setup()

    renderSidebar()

    // Default sort puts the pull request awaiting your review first.
    expect(rowTitles()[0]).toContain('Needs your review')

    await user.click(screen.getByRole('button', { name: /^Sort:/ }))
    await user.click(await screen.findByText('Oldest first'))

    expect(rowTitles()[0]).toContain('A rough draft')
  })
})

describe('PullRequestSidebar departures', () => {
  afterEach(() => {
    vi.useRealTimers()
  })

  it('fades a merged pull request out before dropping it', () => {
    vi.useFakeTimers()

    const { store } = renderSidebar()

    merge(store, 'pr-b')

    // Still there, on its way out, and now saying so.
    expect(within(sidebar()).getByText('Your own work')).toBeInTheDocument()
    expect(within(sidebar()).getByText('Merged')).toBeInTheDocument()
    expect(rowWrapper('Your own work')).toHaveClass('opacity-0')

    act(() => {
      vi.advanceTimersByTime(departureDurationMs)
    })

    expect(
      within(sidebar()).queryByText('Your own work')
    ).not.toBeInTheDocument()
    expect(within(sidebar()).getByText('2 pull requests')).toBeInTheDocument()
  })

  it('fades a closed pull request out the same way', () => {
    vi.useFakeTimers()

    const { store } = renderSidebar()

    act(() => {
      store.dispatch(
        pullRequestsActions.upsertItem({
          ...pullRequests[1],
          closedAt: '2024-06-01T00:00:00Z',
          state: 'CLOSED'
        })
      )
    })

    expect(rowWrapper('Your own work')).toHaveClass('opacity-0')

    act(() => {
      vi.advanceTimersByTime(departureDurationMs)
    })

    expect(
      within(sidebar()).queryByText('Your own work')
    ).not.toBeInTheDocument()
  })

  it('keeps the departing row where it was rather than letting it re-sort', () => {
    vi.useFakeTimers()

    const { store } = renderSidebar()

    expect(rowTitles()[2]).toContain('A rough draft')

    // Merging bumps `updatedAt`, which would otherwise pull the row up the
    // list under the default sort while it is still on screen.
    merge(store, 'pr-c')

    expect(rowTitles()[2]).toContain('A rough draft')

    act(() => {
      vi.advanceTimersByTime(departureDurationMs)
    })

    expect(rowTitles()).toHaveLength(2)
  })

  it('moves you on to the next pull request once the row you merged has gone', () => {
    vi.useFakeTimers()

    const { store } = renderSidebar({ initialPath: '/pull-requests/pr-b' })

    merge(store, 'pr-b')

    // Not yet — the row is still fading, and yanking the page away underneath
    // the merge you just confirmed reads as a glitch.
    expect(screen.getByTestId('pathname')).toHaveTextContent(
      '/pull-requests/pr-b'
    )

    act(() => {
      vi.advanceTimersByTime(departureDurationMs)
    })

    expect(screen.getByTestId('pathname')).toHaveTextContent(
      '/pull-requests/pr-c'
    )
  })

  it('leaves you where you are when a pull request you are not reading is merged', () => {
    vi.useFakeTimers()

    const { store } = renderSidebar({ initialPath: '/pull-requests/pr-a' })

    merge(store, 'pr-b')

    act(() => {
      vi.advanceTimersByTime(departureDurationMs)
    })

    expect(screen.getByTestId('pathname')).toHaveTextContent(
      '/pull-requests/pr-a'
    )
  })

  it('puts the row back when a merge is rolled back mid-fade', () => {
    vi.useFakeTimers()

    const { store } = renderSidebar()

    merge(store, 'pr-b')

    act(() => {
      vi.advanceTimersByTime(departureDurationMs / 2)

      store.dispatch(pullRequestsActions.upsertItem(pullRequests[1]))
    })

    act(() => {
      vi.advanceTimersByTime(departureDurationMs)
    })

    expect(within(sidebar()).getByText('Your own work')).toBeInTheDocument()
    expect(rowWrapper('Your own work')).not.toHaveClass('opacity-0')
    expect(within(sidebar()).getByText('3 pull requests')).toBeInTheDocument()
  })

  it('does not fade a row that a search hid — only one that has left for good', async () => {
    const user = userEvent.setup()

    renderSidebar()

    await user.type(
      screen.getByPlaceholderText('Search pull requests'),
      'draft'
    )

    expect(
      within(sidebar()).queryByText('Your own work')
    ).not.toBeInTheDocument()
  })
})
