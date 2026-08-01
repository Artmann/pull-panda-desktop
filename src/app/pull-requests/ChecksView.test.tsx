/**
 * @vitest-environment jsdom
 */
import { screen, act } from '@testing-library/react'
import { configureStore } from '@reduxjs/toolkit'
import { describe, it, expect, beforeAll } from 'vitest'

import type { Check } from '@/types/pull-request-details'
import type { PullRequest } from '@/types/pull-request'

import checksReducer from '@/app/store/checks-slice'

import {
  createMockCheck,
  createMockPullRequest
} from './__test-helpers__/pull-request-fixtures'
import {
  installObserverStubs,
  renderWithProviders
} from './__test-helpers__/test-utils'
import { ChecksView } from './ChecksView'

beforeAll(() => {
  installObserverStubs()
})

function createChecksViewPullRequest(): PullRequest {
  return createMockPullRequest({
    isAuthor: true,
    number: 7,
    url: 'https://github.com/owner/repo/pull/7'
  })
}

function createTestStore(preloadedState?: { checks?: { items: Check[] } }) {
  return configureStore({
    reducer: {
      checks: checksReducer
    },
    preloadedState
  })
}

describe('ChecksView', () => {
  it('renders empty state when no checks', async () => {
    const pullRequest = createChecksViewPullRequest()
    const store = createTestStore({
      checks: { items: [] }
    })

    await act(async () => {
      renderWithProviders(<ChecksView pullRequest={pullRequest} />, store)
    })

    expect(screen.getByText('No checks found.')).toBeInTheDocument()
  })

  it('renders checks grouped by suite name', async () => {
    const pullRequest = createChecksViewPullRequest()
    const check1 = createMockCheck({
      id: 'check-1',
      name: 'build',
      suiteName: 'GitHub Actions'
    })
    const check2 = createMockCheck({
      id: 'check-2',
      name: 'test',
      suiteName: 'GitHub Actions'
    })
    const check3 = createMockCheck({
      id: 'check-3',
      name: 'deploy',
      suiteName: 'Vercel'
    })
    const store = createTestStore({
      checks: { items: [check1, check2, check3] }
    })

    await act(async () => {
      renderWithProviders(<ChecksView pullRequest={pullRequest} />, store)
    })

    expect(screen.getByText('GitHub Actions')).toBeInTheDocument()
    expect(screen.getByText('Vercel')).toBeInTheDocument()
    expect(screen.getByText('build')).toBeInTheDocument()
    expect(screen.getByText('test')).toBeInTheDocument()
    expect(screen.getByText('deploy')).toBeInTheDocument()
  })

  it('shows Success badge for successful suite', async () => {
    const pullRequest = createChecksViewPullRequest()
    const check = createMockCheck({
      conclusion: 'success'
    })
    const store = createTestStore({
      checks: { items: [check] }
    })

    await act(async () => {
      renderWithProviders(<ChecksView pullRequest={pullRequest} />, store)
    })

    expect(screen.getByText('Success')).toBeInTheDocument()
  })

  it('shows Failed badge for failed suite', async () => {
    const pullRequest = createChecksViewPullRequest()
    const check = createMockCheck({
      conclusion: 'failure'
    })
    const store = createTestStore({
      checks: { items: [check] }
    })

    await act(async () => {
      renderWithProviders(<ChecksView pullRequest={pullRequest} />, store)
    })

    expect(screen.getByText('Failed')).toBeInTheDocument()
  })

  it('shows Running badge for in-progress suite', async () => {
    const pullRequest = createChecksViewPullRequest()
    const check = createMockCheck({
      state: 'in_progress',
      conclusion: null
    })
    const store = createTestStore({
      checks: { items: [check] }
    })

    await act(async () => {
      renderWithProviders(<ChecksView pullRequest={pullRequest} />, store)
    })

    expect(screen.getByText('Running')).toBeInTheDocument()
  })

  it('shows Cancelled badge for cancelled suite', async () => {
    const pullRequest = createChecksViewPullRequest()
    const check = createMockCheck({
      conclusion: 'cancelled'
    })
    const store = createTestStore({
      checks: { items: [check] }
    })

    await act(async () => {
      renderWithProviders(<ChecksView pullRequest={pullRequest} />, store)
    })

    expect(screen.getByText('Cancelled')).toBeInTheDocument()
  })

  it('deduplicates checks by name, keeping most recent', async () => {
    const pullRequest = createChecksViewPullRequest()
    const oldCheck = createMockCheck({
      id: 'check-old',
      name: 'build',
      message: 'Old build',
      syncedAt: '2024-01-01T00:00:00Z'
    })
    const newCheck = createMockCheck({
      id: 'check-new',
      name: 'build',
      message: 'New build',
      syncedAt: '2024-01-02T00:00:00Z'
    })
    const store = createTestStore({
      checks: { items: [oldCheck, newCheck] }
    })

    await act(async () => {
      renderWithProviders(<ChecksView pullRequest={pullRequest} />, store)
    })

    // Should only show the newer check's message
    expect(screen.getByText('New build')).toBeInTheDocument()
    expect(screen.queryByText('Old build')).not.toBeInTheDocument()
  })

  it('renders external link for check with detailsUrl', async () => {
    const pullRequest = createChecksViewPullRequest()
    const check = createMockCheck({
      detailsUrl: 'https://github.com/owner/repo/actions/runs/123'
    })
    const store = createTestStore({
      checks: { items: [check] }
    })

    await act(async () => {
      renderWithProviders(<ChecksView pullRequest={pullRequest} />, store)
    })

    const button = screen.getByTitle('Open on GitHub')

    expect(button).toBeInTheDocument()
  })

  it('handles checks with null suiteName', async () => {
    const pullRequest = createChecksViewPullRequest()
    const check = createMockCheck({
      suiteName: null
    })
    const store = createTestStore({
      checks: { items: [check] }
    })

    await act(async () => {
      renderWithProviders(<ChecksView pullRequest={pullRequest} />, store)
    })

    expect(screen.getByText('Unknown')).toBeInTheDocument()
  })
})
