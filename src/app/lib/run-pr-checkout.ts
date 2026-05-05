import { toast } from 'sonner'

import { checkoutPullRequestBranch } from '@/app/lib/api'
import { connectedReposActions } from '@/app/store/connected-repos-slice'
import type { AppStore } from '@/app/store'

export async function runPullRequestCheckout(
  store: AppStore,
  pullRequestId: string
): Promise<void> {
  store.dispatch(connectedReposActions.setCheckoutInProgress({ pullRequestId }))

  try {
    const result = await checkoutPullRequestBranch(pullRequestId)

    if (result.ok) {
      toast.success(`Checked out ${result.branch ?? 'branch'} locally.`)

      return
    }

    toast.error(result.message ?? 'Failed to check out branch.')
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error'

    toast.error(`Failed to check out branch: ${message}`)
  } finally {
    store.dispatch(
      connectedReposActions.clearCheckoutInProgress({ pullRequestId })
    )
  }
}
