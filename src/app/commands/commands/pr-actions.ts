import { Copy, ExternalLink, GitBranch } from 'lucide-react'
import { toast } from 'sonner'

import type { CheckoutPullRequestResult } from '@/types/repo-checkout'

import { commandRegistry } from '../registry'
import { getStore } from '../store-accessor'

// Open in GitHub command
commandRegistry.register({
  id: 'pr.open-in-github',
  label: 'Open in GitHub',
  icon: ExternalLink,
  group: 'pull request',
  shortcut: { key: 'o' },
  isAvailable: (ctx) =>
    ctx.view === 'pr-detail' && ctx.pullRequest !== undefined,
  execute: (ctx) => {
    if (!ctx.pullRequest?.url) {
      return
    }

    window.auth.openUrl(ctx.pullRequest.url)
  }
})

// Copy PR link command
commandRegistry.register({
  id: 'pr.copy-link',
  label: 'Copy Link',
  icon: Copy,
  group: 'pull request',
  shortcut: { key: 'c', mod: true, shift: true },
  isAvailable: (ctx) =>
    ctx.view === 'pr-detail' && ctx.pullRequest !== undefined,
  execute: async (ctx) => {
    if (!ctx.pullRequest?.url) return

    try {
      await navigator.clipboard.writeText(ctx.pullRequest.url)
      toast.success('Link copied to clipboard')
    } catch (error) {
      toast.error('Failed to copy link')
    }
  }
})

// Check out branch command
commandRegistry.register({
  id: 'pr.checkout-branch',
  label: 'Check Out Branch',
  icon: GitBranch,
  group: 'pull request',
  shortcut: { key: 'b' },
  isAvailable: (ctx) => {
    const store = getStore()

    if (ctx.view !== 'pr-detail' || !ctx.pullRequest || !store) {
      return false
    }

    if (ctx.pullRequest.headRefName === null) {
      return false
    }

    const fullName = `${ctx.pullRequest.repositoryOwner}/${ctx.pullRequest.repositoryName}`
    const localPath = store.getState().connectedRepos.byFullName[fullName]

    return Boolean(localPath)
  },
  execute: (ctx) => {
    if (!ctx.pullRequest) {
      return
    }

    const pullRequestId = ctx.pullRequest.id

    window.electron.repoCheckout
      .checkout({ pullRequestId })
      .then((result: CheckoutPullRequestResult) => {
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
  }
})

// Copy branch name command
commandRegistry.register({
  id: 'pr.copy-branch',
  label: 'Copy Branch Name',
  icon: GitBranch,
  group: 'pull request',
  isAvailable: (ctx) =>
    ctx.view === 'pr-detail' && ctx.pullRequest !== undefined,
  execute: async () => {
    // Branch name is not directly available in our types
    // This would need to be added to the PR data
    toast.info('Branch name not available')
  }
})
