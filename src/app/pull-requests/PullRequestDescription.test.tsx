/**
 * @vitest-environment jsdom
 */
import { fireEvent, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { updatePullRequest } from '@/app/lib/api'
import { createStore } from '@/app/store'

import { renderWithProviders } from './__test-helpers__/test-utils'
import { PullRequestDescription } from './PullRequestDescription'
import { createPullRequest } from './tasks/__test-helpers__/factories'

vi.mock('@/app/lib/api', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/app/lib/api')>()),
  updatePullRequest: vi.fn()
}))

beforeEach(() => {
  vi.mocked(updatePullRequest).mockClear()
  vi.mocked(updatePullRequest).mockImplementation((request) =>
    Promise.resolve(createPullRequest({ body: request.body ?? null }))
  )
})

function renderDescription(body: string | null = 'Original text') {
  const pullRequest = createPullRequest({ body })
  const store = createStore({
    pullRequests: { initialized: true, items: [pullRequest] }
  } as never)

  renderWithProviders(
    <PullRequestDescription pullRequest={pullRequest} />,
    store
  )

  return store
}

describe('PullRequestDescription', () => {
  it('shows an Edit button that opens the editor with the current text', () => {
    renderDescription()

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))

    expect(screen.getByRole('textbox', { name: 'Description' })).toHaveProperty(
      'value',
      'Original text'
    )
  })

  it('saves only when Save is pressed, not when the editor loses focus', () => {
    const store = renderDescription()

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))

    const editor = screen.getByRole('textbox', { name: 'Description' })

    fireEvent.change(editor, { target: { value: 'New text' } })
    fireEvent.blur(editor)

    expect(updatePullRequest).not.toHaveBeenCalled()

    fireEvent.click(screen.getByRole('button', { name: 'Save' }))

    expect(store.getState().pullRequests.items[0].body).toEqual('New text')
    expect(screen.queryByRole('textbox', { name: 'Description' })).toEqual(null)
  })

  it('throws the change away on Cancel', () => {
    renderDescription()

    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Description' }), {
      target: { value: 'New text' }
    })
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))

    expect(updatePullRequest).not.toHaveBeenCalled()
    expect(screen.getByText('Original text')).toBeDefined()
  })

  it('offers Add description when there is no description yet', () => {
    renderDescription(null)

    expect(
      screen.getByRole('button', { name: 'Add description' })
    ).toBeDefined()
  })
})
