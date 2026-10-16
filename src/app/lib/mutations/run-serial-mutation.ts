import { toast } from 'sonner'

interface SerialMutation<Response> {
  // Mutations that share a key overwrite the same resource, so they are sent
  // one at a time. Use the resource, like `comment-body:<id>`.
  key: string
  // Apply the optimistic store update synchronously, before the request fires.
  optimistic: () => void
  // The API request, kept as a thunk so it can wait its turn in the queue.
  request: () => Promise<Response>
  // Reconcile the store with the server response. Only the last response of a
  // burst is committed; an earlier one would undo the newer optimistic state.
  commit: (response: Response) => void
  // Revert the optimistic update. Only the first mutation of a burst is rolled
  // back to, since it holds the state from before any of them.
  rollback: () => void
  // Fallback toast message; a thrown Error's own message is preferred when present.
  errorMessage: string
}

interface Queue {
  // The last response the server confirmed during this burst, if any. A failure
  // restores this instead of the state from before the burst.
  confirm: (() => void) | null
  // The newest mutation waiting for the one in flight. Anything older that was
  // waiting is dropped, because this one carries the latest state.
  next: SerialMutation<unknown> | null
  rollback: () => void
}

const queues = new Map<string, Queue>()

/**
 * Whether mutations on `key` are still being sent. Until they settle, the
 * store holds a newer state than the database, so updates pushed from the
 * main process must not replace it.
 */
export function isSerialMutationPending(key: string): boolean {
  return queues.has(key)
}

/**
 * Like `runOptimisticMutation`, but for changes that replace a whole resource
 * and can arrive in quick succession, like ticking two checkboxes in the same
 * comment. Applying each response as it lands would flick the UI back to an
 * older state, and parallel requests could reach GitHub out of order. Instead
 * a burst of mutations on one key is sent in order, collapsing everything that
 * waits to the newest, and only the final response is committed.
 */
export function runSerialMutation<Response>(
  mutation: SerialMutation<Response>
): void {
  mutation.optimistic()

  const queue = queues.get(mutation.key)

  if (queue) {
    queue.next = mutation as SerialMutation<unknown>

    return
  }

  queues.set(mutation.key, {
    confirm: null,
    next: null,
    rollback: mutation.rollback
  })

  send(mutation as SerialMutation<unknown>)
}

function send(mutation: SerialMutation<unknown>): void {
  mutation
    .request()
    .then((response) => {
      const queue = queues.get(mutation.key)
      const next = queue?.next

      if (queue && next) {
        queue.confirm = () => mutation.commit(response)
        queue.next = null
        send(next)

        return
      }

      queues.delete(mutation.key)
      mutation.commit(response)
    })
    .catch((error: unknown) => {
      const queue = queues.get(mutation.key)

      queues.delete(mutation.key)

      if (queue?.confirm) {
        queue.confirm()
      } else {
        queue?.rollback()
      }

      const message =
        error instanceof Error ? error.message : mutation.errorMessage

      toast.error(message)
    })
}
