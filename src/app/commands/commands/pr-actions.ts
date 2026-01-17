import { Copy, ExternalLink, GitBranch } from 'lucide-react'
import { toast } from 'sonner'

import { commandRegistry } from '../registry'

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
