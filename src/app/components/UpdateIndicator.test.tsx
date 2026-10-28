/**
 * @vitest-environment jsdom
 */
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'

import type { UpdateStatus } from '@/lib/updates'

import { UpdateIndicatorView } from './UpdateIndicator'

const readyStatus: UpdateStatus = {
  currentVersion: '1.6.0',
  lastCheckedAt: 1_000,
  message: null,
  releaseNotesUrl:
    'https://github.com/Artmann/pull-panda-desktop/releases/tag/v1.7.0',
  state: 'ready',
  version: '1.7.0'
}

function renderIndicator(
  status: UpdateStatus | null,
  isInstalling = false
): {
  onInstall: ReturnType<typeof vi.fn>
  onOpenReleasePage: ReturnType<typeof vi.fn>
} {
  const onInstall = vi.fn()
  const onOpenReleasePage = vi.fn()

  render(
    <UpdateIndicatorView
      isInstalling={isInstalling}
      status={status}
      onInstall={onInstall}
      onOpenReleasePage={onOpenReleasePage}
    />
  )

  return { onInstall, onOpenReleasePage }
}

describe('UpdateIndicatorView', () => {
  it('renders nothing until there is something to act on', () => {
    const states = ['checking', 'downloading', 'error', 'idle', 'unsupported']

    const rendered = states.map((state) => {
      const { container } = render(
        <UpdateIndicatorView
          isInstalling={false}
          status={{ ...readyStatus, state: state as UpdateStatus['state'] }}
          onInstall={() => undefined}
          onOpenReleasePage={() => undefined}
        />
      )

      return container.innerHTML
    })

    expect(rendered).toEqual(['', '', '', '', ''])
  })

  it('restarts to update from the popover', () => {
    const { onInstall } = renderIndicator(readyStatus)

    fireEvent.click(
      screen.getByRole('button', { name: 'Pull Panda 1.7.0 is ready' })
    )
    fireEvent.click(screen.getByRole('button', { name: 'Restart to update' }))

    expect(onInstall).toHaveBeenCalledTimes(1)
  })

  it('disables the restart button while restarting', () => {
    renderIndicator(readyStatus, true)

    fireEvent.click(
      screen.getByRole('button', { name: 'Pull Panda 1.7.0 is ready' })
    )

    expect(
      (screen.getByRole('button', { name: 'Restarting…' }) as HTMLButtonElement)
        .disabled
    ).toEqual(true)
  })

  it('links to the release page when the update has to be downloaded by hand', () => {
    const { onOpenReleasePage } = renderIndicator({
      ...readyStatus,
      message: 'Download it yourself.',
      state: 'available'
    })

    fireEvent.click(
      screen.getByRole('button', { name: 'Pull Panda 1.7.0 is available' })
    )
    fireEvent.click(screen.getByRole('button', { name: 'Open release page' }))

    expect(onOpenReleasePage.mock.calls).toEqual([
      ['https://github.com/Artmann/pull-panda-desktop/releases/tag/v1.7.0']
    ])
  })
})
