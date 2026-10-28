import { beforeEach, describe, expect, it, vi } from 'vitest'

import type { UpdateStatus } from '@/lib/updates'

import {
  describeUpdateStatus,
  reportCheckResult,
  updateHeading
} from './updates'

const toastMock = vi.hoisted(() => ({
  dismiss: vi.fn(),
  error: vi.fn(),
  info: vi.fn(),
  success: vi.fn()
}))

vi.mock('sonner', () => ({ toast: toastMock }))

const idleStatus: UpdateStatus = {
  currentVersion: '1.6.0',
  lastCheckedAt: null,
  message: null,
  releaseNotesUrl: null,
  state: 'idle',
  version: null
}

const readyStatus: UpdateStatus = {
  ...idleStatus,
  lastCheckedAt: 1_000,
  releaseNotesUrl:
    'https://github.com/Artmann/pull-panda-desktop/releases/tag/v1.7.0',
  state: 'ready',
  version: '1.7.0'
}

describe('updateHeading', () => {
  it('names the version when it is known', () => {
    expect([
      updateHeading(readyStatus),
      updateHeading({ ...readyStatus, state: 'available' })
    ]).toEqual(['Pull Panda 1.7.0 is ready', 'Pull Panda 1.7.0 is available'])
  })

  it('falls back to a generic subject when the version is unknown', () => {
    expect(updateHeading({ ...readyStatus, version: null })).toEqual(
      'An update is ready'
    )
  })
})

describe('describeUpdateStatus', () => {
  it('describes every state', () => {
    expect([
      describeUpdateStatus({
        ...readyStatus,
        message: 'Download it from the release page.',
        state: 'available'
      }),
      describeUpdateStatus({ ...idleStatus, state: 'checking' }),
      describeUpdateStatus({ ...idleStatus, state: 'downloading' }),
      describeUpdateStatus({
        ...idleStatus,
        message: 'Could not check.',
        state: 'error'
      }),
      describeUpdateStatus({ ...idleStatus, state: 'unsupported' }),
      describeUpdateStatus(idleStatus),
      describeUpdateStatus(readyStatus)
    ]).toEqual([
      'Pull Panda 1.7.0 is available. Download it from the release page.',
      'Checking for updates…',
      'Downloading the latest version…',
      'Could not check.',
      'Updates are unavailable.',
      'Pull Panda checks for updates automatically.',
      'Pull Panda 1.7.0 is ready. Restart Pull Panda to finish installing it.'
    ])
  })

  it('mentions the last check once there has been one', () => {
    expect(
      describeUpdateStatus({ ...idleStatus, lastCheckedAt: 1_000 })
    ).toMatch(/^Up to date\. Last checked .+\.$/)
  })
})

describe('reportCheckResult', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('says the app is up to date', () => {
    reportCheckResult('toast', { ...idleStatus, lastCheckedAt: 1_000 })

    expect(toastMock.success.mock.calls).toEqual([
      ['Pull Panda 1.6.0 is up to date.', { id: 'toast' }]
    ])
  })

  it('shows why the check failed', () => {
    reportCheckResult('toast', {
      ...idleStatus,
      message: 'Could not check.',
      state: 'error'
    })

    expect(toastMock.error.mock.calls).toEqual([
      ['Could not check.', { id: 'toast' }]
    ])
  })

  it('says the update is downloading', () => {
    reportCheckResult('toast', { ...idleStatus, state: 'downloading' })

    expect(toastMock.info.mock.calls).toEqual([
      [
        'Downloading the update',
        {
          description: 'Pull Panda will let you know when it is ready.',
          id: 'toast'
        }
      ]
    ])
  })

  it('offers the release page for an update it cannot install', () => {
    reportCheckResult('toast', {
      ...readyStatus,
      message: 'Download it yourself.',
      state: 'available'
    })

    expect(toastMock.info.mock.calls).toEqual([
      [
        'Pull Panda 1.7.0 is available',
        {
          action: { label: 'Open release page', onClick: expect.any(Function) },
          description: 'Download it yourself.',
          id: 'toast'
        }
      ]
    ])
  })

  it('swaps the checking toast for the restart toast when an update is ready', () => {
    reportCheckResult('toast', readyStatus)

    expect({
      dismissed: toastMock.dismiss.mock.calls,
      success: toastMock.success.mock.calls
    }).toEqual({
      dismissed: [['toast']],
      success: [
        [
          'Pull Panda 1.7.0 is ready',
          {
            action: { label: 'Restart', onClick: expect.any(Function) },
            description: 'Restart Pull Panda to finish installing it.',
            duration: Infinity,
            id: 'update-ready'
          }
        ]
      ]
    })
  })
})
