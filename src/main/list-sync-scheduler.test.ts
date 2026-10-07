import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  computeListSyncDelay,
  ListSyncScheduler,
  type RateLimitBudget,
  type WindowState,
  windowStateOf
} from './list-sync-scheduler'

const now = new Date('2026-06-11T12:00:00Z').getTime()

function budget(remaining: number, resetInSeconds = 600): RateLimitBudget {
  return {
    limit: 5000,
    remaining,
    resetAt: Math.floor(now / 1000) + resetInSeconds
  }
}

describe('computeListSyncDelay', () => {
  it('polls every 15 seconds while the window is focused', () => {
    expect(computeListSyncDelay('focused', null, now)).toEqual(15_000)
  })

  it('backs off when the window is blurred or hidden', () => {
    expect([
      computeListSyncDelay('blurred', null, now),
      computeListSyncDelay('hidden', null, now)
    ]).toEqual([60_000, 300_000])
  })

  it('keeps the base delay while at least half the budget is left', () => {
    expect(computeListSyncDelay('focused', budget(2500), now)).toEqual(15_000)
  })

  it('doubles the delay below half the budget', () => {
    expect(computeListSyncDelay('focused', budget(2000), now)).toEqual(30_000)
  })

  it('quadruples the delay below a quarter of the budget', () => {
    expect(computeListSyncDelay('focused', budget(1000), now)).toEqual(60_000)
  })

  it('waits for the reset below 10% of the budget', () => {
    expect(computeListSyncDelay('focused', budget(400, 600), now)).toEqual(
      605_000
    )
  })

  it('never waits less than the base delay when the reset is close', () => {
    expect(computeListSyncDelay('hidden', budget(400, 10), now)).toEqual(
      300_000
    )
  })
})

describe('windowStateOf', () => {
  function fakeWindow(overrides: {
    isDestroyed?: boolean
    isFocused?: boolean
    isMinimized?: boolean
    isVisible?: boolean
  }) {
    const state = {
      isDestroyed: false,
      isFocused: false,
      isMinimized: false,
      isVisible: true,
      ...overrides
    }

    return {
      isDestroyed: () => state.isDestroyed,
      isFocused: () => state.isFocused,
      isMinimized: () => state.isMinimized,
      isVisible: () => state.isVisible
    }
  }

  it('treats a missing or destroyed window as hidden', () => {
    expect([
      windowStateOf(null),
      windowStateOf(fakeWindow({ isDestroyed: true }))
    ]).toEqual(['hidden', 'hidden'])
  })

  it('treats an invisible or minimized window as hidden', () => {
    expect([
      windowStateOf(fakeWindow({ isVisible: false })),
      windowStateOf(fakeWindow({ isMinimized: true }))
    ]).toEqual(['hidden', 'hidden'])
  })

  it('tells a focused window from a blurred one', () => {
    expect([
      windowStateOf(fakeWindow({ isFocused: true })),
      windowStateOf(fakeWindow({}))
    ]).toEqual(['focused', 'blurred'])
  })
})

describe('ListSyncScheduler', () => {
  let windowState: WindowState

  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(now)
    windowState = 'focused'
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  function createScheduler(run: () => Promise<void>) {
    return new ListSyncScheduler({
      getBudget: () => Promise.resolve(null),
      getWindowState: () => windowState,
      minimumGapMs: 5_000,
      run
    })
  }

  it('runs right away on start and then on the timer', async () => {
    const run = vi.fn(() => Promise.resolve())
    const scheduler = createScheduler(run)

    scheduler.start()
    await vi.advanceTimersByTimeAsync(0)

    expect(run).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(15_000)

    expect(run).toHaveBeenCalledTimes(2)

    scheduler.stop()
  })

  it('uses the window state when picking the next delay', async () => {
    const run = vi.fn(() => Promise.resolve())
    const scheduler = createScheduler(run)

    windowState = 'hidden'
    scheduler.start()
    await vi.advanceTimersByTimeAsync(0)
    await vi.advanceTimersByTimeAsync(60_000)

    expect(run).toHaveBeenCalledTimes(1)

    scheduler.stop()
  })

  it('runs a request during a run once that run finishes', async () => {
    let finishRun: () => void = () => undefined
    const run = vi.fn(
      () =>
        new Promise<void>((resolve) => {
          finishRun = resolve
        })
    )
    const scheduler = createScheduler(run)

    windowState = 'hidden'
    scheduler.start()
    await vi.advanceTimersByTimeAsync(0)

    scheduler.requestSync()
    scheduler.requestSync()
    finishRun()
    await vi.advanceTimersByTimeAsync(5_000)

    expect(run).toHaveBeenCalledTimes(2)

    scheduler.stop()
  })

  it('pulls a pending timer forward when a sync is requested', async () => {
    const run = vi.fn(() => Promise.resolve())
    const scheduler = createScheduler(run)

    windowState = 'hidden'
    scheduler.start()
    await vi.advanceTimersByTimeAsync(10_000)

    scheduler.requestSync()
    await vi.advanceTimersByTimeAsync(0)

    expect(run).toHaveBeenCalledTimes(2)

    scheduler.stop()
  })

  it('merges requests that arrive within the minimum gap', async () => {
    const run = vi.fn(() => Promise.resolve())
    const scheduler = createScheduler(run)

    scheduler.start()
    await vi.advanceTimersByTimeAsync(1_000)

    scheduler.requestSync()
    scheduler.requestSync()
    await vi.advanceTimersByTimeAsync(3_000)

    expect(run).toHaveBeenCalledTimes(1)

    await vi.advanceTimersByTimeAsync(1_000)

    expect(run).toHaveBeenCalledTimes(2)

    scheduler.stop()
  })

  it('keeps going after a failed run', async () => {
    const run = vi
      .fn<() => Promise<void>>()
      .mockRejectedValueOnce(new Error('offline'))
      .mockResolvedValue(undefined)
    const scheduler = createScheduler(run)
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined)

    scheduler.start()
    await vi.advanceTimersByTimeAsync(15_000)

    expect(run).toHaveBeenCalledTimes(2)

    scheduler.stop()
    consoleError.mockRestore()
  })

  it('stops running after stop', async () => {
    const run = vi.fn(() => Promise.resolve())
    const scheduler = createScheduler(run)

    scheduler.start()
    await vi.advanceTimersByTimeAsync(0)
    scheduler.stop()
    scheduler.requestSync()
    await vi.advanceTimersByTimeAsync(60_000)

    expect(run).toHaveBeenCalledTimes(1)
  })
})
