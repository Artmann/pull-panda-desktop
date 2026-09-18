/**
 * @vitest-environment jsdom
 */
import { render, screen } from '@testing-library/react'
import { configureStore } from '@reduxjs/toolkit'
import { Provider } from 'react-redux'
import { MemoryRouter } from 'react-router'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import type { PullRequest } from '@/types/pull-request'

import { createMockPullRequest } from '@/app/pull-requests/__test-helpers__/pull-request-fixtures'
import pullRequestsReducer from '@/app/store/pull-requests-slice'

import { HomePage } from './HomePage'

vi.mock('@/app/lib/store/authContext', () => ({
  useAuth: vi.fn()
}))

import { useAuth } from '@/app/lib/store/authContext'

const mockUseAuth = vi.mocked(useAuth)

function mockUser(user: { login: string; name: string | null } | null): void {
  mockUseAuth.mockReturnValue({
    status: 'authenticated',
    user: user
      ? { ...user, avatar_url: 'https://example.com/avatar.png' }
      : null,
    userCode: null,
    verificationUri: null,
    error: null,
    isNewSignIn: false,
    startLogin: vi.fn(),
    logout: vi.fn(),
    openVerificationUrl: vi.fn(),
    clearNewSignIn: vi.fn()
  })
}

function createTestStore(pullRequests: PullRequest[] = [], initialized = true) {
  return configureStore({
    reducer: { pullRequests: pullRequestsReducer },
    preloadedState: { pullRequests: { initialized, items: pullRequests } }
  })
}

function renderWithProviders(
  ui: React.ReactElement,
  { store = createTestStore() } = {}
) {
  return render(
    <Provider store={store}>
      <MemoryRouter>{ui}</MemoryRouter>
    </Provider>
  )
}

describe('HomePage', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-01-15T10:00:00'))

    mockUser({ login: 'johndoe', name: 'John Doe' })
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.clearAllMocks()
  })

  describe('greeting display', () => {
    it('renders greeting with user name when available', () => {
      renderWithProviders(<HomePage />)

      expect(screen.getByText(/John/)).toBeInTheDocument()
    })

    it('falls back to login when name is null', () => {
      mockUser({ login: 'johndoe', name: null })

      renderWithProviders(<HomePage />)

      expect(screen.getByText(/johndoe/)).toBeInTheDocument()
    })

    it('falls back to "User" when there is no user', () => {
      mockUser(null)

      renderWithProviders(<HomePage />)

      expect(screen.getByText(/User/)).toBeInTheDocument()
    })
  })

  describe('time-based greeting', () => {
    it('shows "Good morning" between 3:00-11:59', () => {
      vi.setSystemTime(new Date('2024-01-15T08:00:00'))

      renderWithProviders(<HomePage />)

      expect(screen.getByText(/Good morning/)).toBeInTheDocument()
    })

    it('shows "Good afternoon" between 12:00-18:00', () => {
      vi.setSystemTime(new Date('2024-01-15T14:00:00'))

      renderWithProviders(<HomePage />)

      expect(screen.getByText(/Good afternoon/)).toBeInTheDocument()
    })

    it('shows "Good evening" between 18:01-2:59', () => {
      vi.setSystemTime(new Date('2024-01-15T20:00:00'))

      renderWithProviders(<HomePage />)

      expect(screen.getByText(/Good evening/)).toBeInTheDocument()
    })

    it('shows "Good evening" at 1:00 AM', () => {
      vi.setSystemTime(new Date('2024-01-15T01:00:00'))

      renderWithProviders(<HomePage />)

      expect(screen.getByText(/Good evening/)).toBeInTheDocument()
    })
  })

  describe('summary', () => {
    it('always points at the sidebar', () => {
      renderWithProviders(<HomePage />)

      expect(
        screen.getByText('Pick a pull request from the sidebar to get started.')
      ).toBeInTheDocument()
    })

    it('says so when nothing is open', () => {
      renderWithProviders(<HomePage />)

      expect(
        screen.getByText('Nothing open right now. Enjoy the quiet.')
      ).toBeInTheDocument()
    })

    it('counts reviews waiting on you and your own open pull requests', () => {
      const store = createTestStore([
        createMockPullRequest({
          id: 'pr-1',
          isAuthor: false,
          isReviewer: true
        }),
        createMockPullRequest({
          id: 'pr-2',
          isAuthor: false,
          isReviewer: true
        }),
        createMockPullRequest({ id: 'pr-3', isAuthor: true })
      ])

      renderWithProviders(<HomePage />, { store })

      expect(
        screen.getByText(
          '2 reviews are waiting on you and 1 of your own is open.'
        )
      ).toBeInTheDocument()
    })

    it('ignores closed and merged pull requests', () => {
      const store = createTestStore([
        createMockPullRequest({ id: 'pr-1', isAuthor: true, state: 'MERGED' }),
        createMockPullRequest({ id: 'pr-2', isAuthor: true, state: 'CLOSED' })
      ])

      renderWithProviders(<HomePage />, { store })

      expect(
        screen.getByText('Nothing open right now. Enjoy the quiet.')
      ).toBeInTheDocument()
    })

    it('shows a loading message until the store is initialized', () => {
      const store = createTestStore([], false)

      renderWithProviders(<HomePage />, { store })

      expect(
        screen.getByText('Loading your pull requests…')
      ).toBeInTheDocument()
    })
  })
})
