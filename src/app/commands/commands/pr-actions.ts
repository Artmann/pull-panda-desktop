import { Copy, ExternalLink, GitBranch } from 'lucide-react'

import { runPullRequestCheckout } from '@/app/lib/run-pr-checkout'
import {
  canCopyBranchName,
  copyPullRequestBranchName,
  copyPullRequestLink,
  openPullRequestOnGitHub
} from '@/app/pull-requests/pull-request-actions'

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
    if (!ctx.pullRequest) {
      return
    }

    openPullRequestOnGitHub(ctx.pullRequest)
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
  execute: (ctx) => {
    if (!ctx.pullRequest) {
      return
    }

    copyPullRequestLink(ctx.pullRequest)
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
    const store = getStore()

    if (!ctx.pullRequest || !store) {
      return
    }

    void runPullRequestCheckout(store, ctx.pullRequest.id)
  }
})

// Copy branch name command
commandRegistry.register({
  id: 'pr.copy-branch',
  label: 'Copy Branch Name',
  icon: GitBranch,
  group: 'pull request',
  isAvailable: (ctx) =>
    ctx.view === 'pr-detail' &&
    ctx.pullRequest !== undefined &&
    canCopyBranchName(ctx.pullRequest),
  execute: (ctx) => {
    if (!ctx.pullRequest) {
      return
    }

    copyPullRequestBranchName(ctx.pullRequest)
  }
})
