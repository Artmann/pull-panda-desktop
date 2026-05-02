/**
 * @vitest-environment jsdom
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { createCheckTask } from '../__test-helpers__/factories'

import { CheckExpansion } from './CheckExpansion'

beforeEach(() => {
  window.electron = {
    ...window.electron,
    openUrl: vi.fn()
  }
})

describe('CheckExpansion', () => {
  it('renders the message inside a pre block', () => {
    render(
      <CheckExpansion
        task={createCheckTask({ message: 'Build failed at step 3' })}
      />
    )

    const pre = screen.getByText('Build failed at step 3')

    expect(pre.tagName.toLowerCase()).toEqual('pre')
  })

  it('falls back to a placeholder when there is no message', () => {
    render(<CheckExpansion task={createCheckTask({ message: null })} />)

    expect(
      screen.getByText('No additional details were reported by this check.')
    ).toBeDefined()
  })

  it('renders the View full logs button only when detailsUrl is present', () => {
    const { rerender } = render(
      <CheckExpansion
        task={createCheckTask({ detailsUrl: null, message: 'msg' })}
      />
    )

    expect(screen.queryByRole('button', { name: /view full logs/i })).toEqual(
      null
    )

    rerender(
      <CheckExpansion
        task={createCheckTask({
          detailsUrl: 'https://example.com/run/1',
          message: 'msg'
        })}
      />
    )

    expect(
      screen.getByRole('button', { name: /view full logs/i })
    ).toBeDefined()
  })

  it('opens detailsUrl via window.electron when the button is clicked', () => {
    render(
      <CheckExpansion
        task={createCheckTask({
          detailsUrl: 'https://example.com/run/1',
          message: 'msg'
        })}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: /view full logs/i }))

    expect(window.electron.openUrl).toHaveBeenCalledWith(
      'https://example.com/run/1'
    )
  })
})
