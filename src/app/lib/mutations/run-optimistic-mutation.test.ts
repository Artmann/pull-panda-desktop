import { afterEach, describe, expect, it, vi } from 'vitest'
import { toast } from 'sonner'

import { runOptimisticMutation } from './run-optimistic-mutation'

vi.mock('sonner', () => ({
  toast: { error: vi.fn() }
}))

const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

describe('runOptimisticMutation', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('applies the optimistic update before firing the request', () => {
    const order: string[] = []

    runOptimisticMutation({
      optimistic: () => order.push('optimistic'),
      request: () => {
        order.push('request')
        return Promise.resolve('ok')
      },
      rollback: () => order.push('rollback'),
      errorMessage: 'failed'
    })

    expect(order).toEqual(['optimistic', 'request'])
  })

  it('returns synchronously without awaiting the request', () => {
    let resolved = false

    const result = runOptimisticMutation({
      optimistic: vi.fn(),
      request: () =>
        new Promise<void>((resolve) => {
          setTimeout(() => {
            resolved = true
            resolve()
          }, 10)
        }),
      rollback: vi.fn(),
      errorMessage: 'failed'
    })

    expect(result).toBeUndefined()
    expect(resolved).toEqual(false)
  })

  it('commits the server response on success and never rolls back', async () => {
    const commit = vi.fn()
    const rollback = vi.fn()

    runOptimisticMutation({
      optimistic: vi.fn(),
      request: () => Promise.resolve({ id: 'pr-1' }),
      commit,
      rollback,
      errorMessage: 'failed'
    })

    await flush()

    expect(commit).toHaveBeenCalledWith({ id: 'pr-1' })
    expect(rollback).not.toHaveBeenCalled()
    expect(toast.error).not.toHaveBeenCalled()
  })

  it('rolls back and toasts the error message on failure', async () => {
    const rollback = vi.fn()

    runOptimisticMutation({
      optimistic: vi.fn(),
      request: () => Promise.reject(new Error('boom')),
      rollback,
      errorMessage: 'fallback message'
    })

    await flush()

    expect(rollback).toHaveBeenCalledTimes(1)
    expect(toast.error).toHaveBeenCalledWith('boom')
  })

  it('falls back to the provided message when the rejection is not an Error', async () => {
    runOptimisticMutation({
      optimistic: vi.fn(),
      request: () => Promise.reject('not an error'),
      rollback: vi.fn(),
      errorMessage: 'fallback message'
    })

    await flush()

    expect(toast.error).toHaveBeenCalledWith('fallback message')
  })

  it('runs settled after the request resolves and after it rejects', async () => {
    const settledOnSuccess = vi.fn()

    runOptimisticMutation({
      optimistic: vi.fn(),
      request: () => Promise.resolve('ok'),
      rollback: vi.fn(),
      settled: settledOnSuccess,
      errorMessage: 'failed'
    })

    await flush()

    expect(settledOnSuccess).toHaveBeenCalledTimes(1)

    const settledOnFailure = vi.fn()

    runOptimisticMutation({
      optimistic: vi.fn(),
      request: () => Promise.reject(new Error('boom')),
      rollback: vi.fn(),
      settled: settledOnFailure,
      errorMessage: 'failed'
    })

    await flush()

    expect(settledOnFailure).toHaveBeenCalledTimes(1)
  })
})
