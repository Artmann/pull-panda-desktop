/**
 * @vitest-environment jsdom
 */
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import type { Review } from '@/types/pull-request-details'

import { ReviewBadge } from './ReviewBadge'

function buildReview(overrides?: Partial<Review>): Review {
  return {
    authorAvatarUrl: 'https://github.com/octocat.png',
    authorLogin: 'octocat',
    body: null,
    bodyHtml: null,
    gitHubCreatedAt: '2026-01-01T00:00:00Z',
    gitHubId: 'review-github-1',
    gitHubNumericId: 1,
    gitHubSubmittedAt: '2026-01-01T00:00:00Z',
    id: 'review-1',
    pullRequestId: 'pr-1',
    state: 'APPROVED',
    syncedAt: '2026-01-01T00:00:00Z',
    url: null,
    ...overrides
  }
}

describe('ReviewBadge', () => {
  it('renders an approved badge with the success color', () => {
    render(<ReviewBadge review={buildReview({ state: 'APPROVED' })} />)

    const badge = screen.getByText('Approved')

    expect(badge).toHaveClass('text-status-success-foreground')
  })

  it('renders a changes requested badge with the danger color', () => {
    render(<ReviewBadge review={buildReview({ state: 'CHANGES_REQUESTED' })} />)

    const badge = screen.getByText('Requested changes')

    expect(badge).toHaveClass('text-status-danger-foreground')
  })

  it('renders a commented badge with the muted color for other states', () => {
    render(<ReviewBadge review={buildReview({ state: 'COMMENTED' })} />)

    const badge = screen.getByText('Commented')

    expect(badge).toHaveClass('text-muted-foreground')
  })

  it('renders the author avatar when an avatar url is present', () => {
    render(<ReviewBadge review={buildReview()} />)

    const avatar = screen.getByRole('img')

    expect(avatar).toHaveAttribute('alt', 'octocat')
    expect(avatar).toHaveAttribute('src', 'https://github.com/octocat.png')
  })

  it('renders a dot placeholder when no avatar url is present', () => {
    render(<ReviewBadge review={buildReview({ authorAvatarUrl: null })} />)

    expect(screen.queryByRole('img')).not.toBeInTheDocument()
  })
})
