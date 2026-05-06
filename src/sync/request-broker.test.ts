import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { requestBroker } from './request-broker'

describe('requestBroker', () => {
  beforeEach(() => {
    requestBroker.reset()
    requestBroker.configure({
      maxConcurrent: 30,
      restPointsPerMinute: 700,
      graphqlPointsPerMinute: 1500
    })
  })

  describe('acquire/release', () => {
    it('allows requests up to the concurrency cap', async () => {
      requestBroker.configure({ maxConcurrent: 3 })

      const release1 = await requestBroker.acquire('rest')
      const release2 = await requestBroker.acquire('rest')
      const release3 = await requestBroker.acquire('rest')

      expect(requestBroker.getInFlight()).toEqual(3)

      release1()
      release2()
      release3()

      expect(requestBroker.getInFlight()).toEqual(0)
    })

    it('queues requests when at capacity and resumes on release', async () => {
      requestBroker.configure({ maxConcurrent: 1 })

      const release1 = await requestBroker.acquire('rest')

      let acquired = false
      const pending = requestBroker.acquire('rest').then((release) => {
        acquired = true

        return release
      })

      await Promise.resolve()
      expect(acquired).toEqual(false)

      release1()

      const release2 = await pending
      expect(acquired).toEqual(true)

      release2()
    })

    it('release is idempotent', async () => {
      const release = await requestBroker.acquire('rest')

      release()
      release()

      expect(requestBroker.getInFlight()).toEqual(0)
    })
  })

  describe('cost tracking', () => {
    it('records costs and exposes the windowed total', () => {
      requestBroker.recordCost('graphql', 100)
      requestBroker.recordCost('graphql', 200)

      expect(requestBroker.getWindowCost('graphql')).toEqual(300)
    })

    it('drops entries older than the 60s window', () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-05-06T00:00:00.000Z'))

      requestBroker.recordCost('rest', 50)

      vi.advanceTimersByTime(61_000)

      expect(requestBroker.getWindowCost('rest')).toEqual(0)

      vi.useRealTimers()
    })

    it('keeps rest and graphql windows separate', () => {
      requestBroker.recordCost('rest', 10)
      requestBroker.recordCost('graphql', 20)

      expect(requestBroker.getWindowCost('rest')).toEqual(10)
      expect(requestBroker.getWindowCost('graphql')).toEqual(20)
    })

    it('ignores zero or negative costs', () => {
      requestBroker.recordCost('rest', 0)
      requestBroker.recordCost('rest', -5)

      expect(requestBroker.getWindowCost('rest')).toEqual(0)
    })
  })

  describe('sliding-window pause', () => {
    afterEach(() => {
      vi.useRealTimers()
    })

    it('blocks acquire when the window budget is exhausted', async () => {
      vi.useFakeTimers()
      vi.setSystemTime(new Date('2026-05-06T00:00:00.000Z'))

      requestBroker.configure({ graphqlPointsPerMinute: 100 })
      requestBroker.recordCost('graphql', 100)

      let acquired = false
      const pending = requestBroker.acquire('graphql').then((release) => {
        acquired = true

        return release
      })

      // Drain microtasks so the broker has a chance to schedule its sleep.
      await Promise.resolve()
      await Promise.resolve()
      expect(acquired).toEqual(false)

      // Advance past the 60s window so the recorded cost expires.
      await vi.advanceTimersByTimeAsync(61_000)

      const release = await pending
      expect(acquired).toEqual(true)

      release()
    })
  })
})
