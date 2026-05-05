import { toast } from 'sonner'

import { checkoutPullRequestBranch } from '@/app/lib/api'
import { connectedReposActions } from '@/app/store/connected-repos-slice'
import type { AppStore } from '@/app/store'

export function runPullRequestCheckout(
  store: AppStore,
  pullRequestId: string
): Promise<void> {
  store.dispatch(connectedReposActions.setCheckoutInProgress({ pullRequestId }))

  return checkoutPullRequestBranch(pullRequestId)
    .then((result) => {
      if (result.ok) {
        toast.success(`Checked out ${result.branch ?? 'branch'} locally.`)

        return
      }

      toast.error(result.message ?? 'Failed to check out branch.')
    })
    .catch((error: unknown) => {
      const message = error instanceof Error ? error.message : 'Unknown error'

      toast.error(`Failed to check out branch: ${message}`)
    })
    .finally(() => {
      store.dispatch(
        connectedReposActions.clearCheckoutInProgress({ pullRequestId })
      )
    })
}
