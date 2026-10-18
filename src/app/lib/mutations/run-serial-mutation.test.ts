import { toast } from 'sonner'
import { afterEach, describe, expect, it, vi } from 'vitest'

import { runSerialMutation } from './run-serial-mutation'

vi.mock('sonner', () => ({
  toast: { error: vi.fn() }
}))

const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

interface Deferred {
  reject: (error: Error) => void
  resolve: (value: string) => void
}

// Runs mutations against a fake store and records every request and store
// write, with each request resolved by hand so the test controls the timing.
function setup() {
  const events: string[] = []
  const pending: Deferred[] = []
  let store = 'A'

  const mutate = (value: string, key = 'body:1') => {
    const previous = store

    runSerialMutation({
      commit: (response: string) => {
        store = response
        events.push(`commit ${response}`)
      },
      errorMessage: 'failed',
      key,
      optimistic: () => {
        store = value
        events.push(`optimistic ${value}`)
      },
      request: () => {
        events.push(`request ${value}`)

        return new Promise<string>((resolve, reject) => {
          pending.push({ reject, resolve })
        })
      },
      rollback: () => {
        store = previous
        events.push(`rollback ${previous}`)
      }
    })
  }

  return { events, mutate, pending, store: () => store }
}

describe('runSerialMutation', () => {
  afterEach(() => {
    vi.clearAllMocks()
  })

  it('commits only the last response of a burst', async () => {
    const { events, mutate, pending, store } = setup()

    mutate('B')
    mutate('A')

    pending[0].resolve('B')
    await flush()
    pending[1].resolve('A')
    await flush()

    expect(events).toEqual([
      'optimistic B',
      'request B',
      'optimistic A',
      'request A',
      'commit A'
    ])
    expect(store()).toEqual('A')
  })

  it('sends only the newest of the mutations that waited', async () => {
    const { events, mutate, pending } = setup()

    mutate('B')
    mutate('C')
    mutate('D')

    pending[0].resolve('B')
    await flush()
    pending[1].resolve('D')
    await flush()

    expect(events.filter((event) => event.startsWith('request'))).toEqual([
      'request B',
      'request D'
    ])
  })

  it('rolls back to the state before the burst when nothing was saved', async () => {
    const { events, mutate, pending, store } = setup()

    mutate('B')
    mutate('C')

    pending[0].reject(new Error('Nope'))
    await flush()

    expect(events).toEqual([
      'optimistic B',
      'request B',
      'optimistic C',
      'rollback A'
    ])
    expect(store()).toEqual('A')
    expect(toast.error).toHaveBeenCalledWith('Nope')
  })

  it('keeps what the server confirmed when a later request fails', async () => {
    const { mutate, pending, store } = setup()

    mutate('B')
    mutate('C')

    pending[0].resolve('B')
    await flush()
    pending[1].reject(new Error('Nope'))
    await flush()

    expect(store()).toEqual('B')
  })

  it('runs mutations on different keys independently', async () => {
    const { events, mutate } = setup()

    mutate('B', 'body:1')
    mutate('C', 'body:2')
    await flush()

    expect(events).toEqual([
      'optimistic B',
      'request B',
      'optimistic C',
      'request C'
    ])
  })
})
