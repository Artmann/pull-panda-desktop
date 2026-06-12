import { toast } from 'sonner'

interface OptimisticMutation<Response> {
  // Apply the optimistic store update synchronously, before the request fires.
  optimistic: () => void
  // The API request, kept as a thunk so the calling handler stays synchronous.
  request: () => Promise<Response>
  // Reconcile the store with the server response on success.
  commit?: (response: Response) => void
  // Revert the optimistic update when the request fails.
  rollback: () => void
  // Runs after the request settles, on both success and failure — use to reset a
  // loading flag that must clear regardless of outcome.
  settled?: () => void
  // Fallback toast message; a thrown Error's own message is preferred when present.
  errorMessage: string
}

// The single place the project's optimistic-update-then-rollback dance lives:
// apply the optimistic change, fire the request, reconcile on success, and on
// failure roll back and surface a toast. Returns synchronously — the request is
// handled with .then/.catch rather than awaited — so event handlers never block
// a UI framework's own close/dismiss behaviour while the request is in flight.
export function runOptimisticMutation<Response>(
  mutation: OptimisticMutation<Response>
): void {
  mutation.optimistic()

  mutation
    .request()
    .then((response) => {
      mutation.commit?.(response)
    })
    .catch((error: unknown) => {
      mutation.rollback()

      const message =
        error instanceof Error ? error.message : mutation.errorMessage

      toast.error(message)
    })
    .finally(() => {
      mutation.settled?.()
    })
}
