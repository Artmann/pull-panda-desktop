/**
 * @vitest-environment jsdom
 */
import { configureStore } from '@reduxjs/toolkit'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Provider } from 'react-redux'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router'
import { describe, expect, it } from 'vitest'

import checksReducer from '@/app/store/checks-slice'
import pullRequestsReducer from '@/app/store/pull-requests-slice'
import type { Check } from '@/types/pull-request-details'
import type { PullRequest } from '@/types/pull-request'

import { createMockPullRequest } from '../__test-helpers__/pull-request-fixtures'
import { PullRequestSidebar } from './PullRequestSidebar'

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

  return <div data-testid="pathname">{location.pathname}</div>
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

  return render(
    <Provider store={store}>
      <MemoryRouter initialEntries={[initialPath]}>
        <PullRequestSidebar />
        <LocationProbe />
        <Routes>
          <Route
            element={null}
            path="*"
          />
        </Routes>
      </MemoryRouter>
    </Provider>
  )
}

const sidebar = () =>
  screen.getByRole('complementary', { name: 'Pull requests' })

const rowTitles = (): string[] =>
  within(sidebar())
    .getAllByRole('button')
    .map((button) => button.textContent ?? '')
    .filter((text) => text.includes('#'))
    .map((text) => text)

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

  it('still shows the pull request you are looking at once it is merged', () => {
    renderSidebar({ initialPath: '/pull-requests/pr-merged' })

    expect(within(sidebar()).getByText('Already merged')).toBeInTheDocument()
  })

  it('navigates to a pull request when its row is clicked', async () => {
    const user = userEvent.setup()

    renderSidebar()

    await user.click(within(sidebar()).getByText('Your own work'))

    expect(screen.getByTestId('pathname')).toHaveTextContent(
      '/pull-requests/pr-b'
    )
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
