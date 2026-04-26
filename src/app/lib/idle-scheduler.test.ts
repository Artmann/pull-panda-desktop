/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from 'vitest'

import { scheduleIdleTask } from './idle-scheduler'

describe('scheduleIdleTask', () => {
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('does not run a cancelled idle task', () => {
    const cancelIdleCallback = vi.fn()
    const requestIdleCallback = vi.fn(() => 123)
    const task = vi.fn()

    Object.assign(window, {
      cancelIdleCallback,
      requestIdleCallback
    })

    const scheduledTask = scheduleIdleTask(task)

    scheduledTask.cancel()

    expect(cancelIdleCallback).toHaveBeenCalledWith(123)
    expect(task).not.toHaveBeenCalled()
  })

  it('uses a timer fallback when idle callbacks are unavailable', () => {
    const task = vi.fn()

    vi.useFakeTimers()

    Object.assign(window, {
      cancelIdleCallback: undefined,
      requestIdleCallback: undefined
    })

    scheduleIdleTask(task)

    vi.runOnlyPendingTimers()

    expect(task).toHaveBeenCalledTimes(1)
  })
})
