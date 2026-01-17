import { ArrowRight, GitPullRequest, Home } from 'lucide-react'

import { commandRegistry } from '../registry'
import { getNavigate } from '../context'
import { getStore } from '../store-accessor'
import type { PullRequest } from '@/types/pull-request'

// Tab names as used in the app
const tabs = ['overview', 'commits', 'checks', 'files'] as const

// Tab navigation commands (1-4 keys on PR detail view)
tabs.forEach((tab, index) => {
  commandRegistry.register({
    id: `navigation.tab-${tab}`,
    icon: ArrowRight,
    label: `Go To ${tab.charAt(0).toUpperCase() + tab.slice(1)}`,
    group: 'navigation',
    shortcut: { key: String(index + 1) },
    isAvailable: (ctx) =>
      ctx.view === 'pr-detail' && ctx.pullRequest !== undefined,
    execute: (ctx) => {
      if (!ctx.pullRequest) return
      const navigate = getNavigate()
      navigate(`/pull-requests/${ctx.pullRequest.id}?tab=${tab}`)
    }
  })
})

// Go home command
commandRegistry.register({
  id: 'navigation.home',
  label: 'Go To Home',
  icon: Home,
  group: 'navigation',
  shortcut: { key: 'h', mod: true },
  isAvailable: (ctx) => ctx.view !== 'home',
  execute: () => {
    const navigate = getNavigate()
    navigate('/')
  }
})

// Open Pull Request command (parameterized)
commandRegistry.register<PullRequest>({
  id: 'navigation.open-pr',
  label: 'Open Pull Request',
  icon: GitPullRequest,
  group: 'navigation',
  shortcut: { key: 'p', mod: true },
  isAvailable: () => true,
  param: {
    type: 'select',
    placeholder: 'Search pull requests...',
    getOptions: (_context, query) => {
      const store = getStore()

      if (!store) return []

      const pullRequests = store.getState().pullRequests.items
      const lowerQuery = query.toLowerCase()

      return pullRequests
        .filter(
          (pullRequest) =>
            pullRequest.title.toLowerCase().includes(lowerQuery) ||
            pullRequest.number.toString().includes(query)
        )
        .slice(0, 20)
        .map((pullRequest) => ({
          id: pullRequest.id,
          label: `#${pullRequest.number} ${pullRequest.title}`,
          description: `${pullRequest.repositoryOwner}/${pullRequest.repositoryName}`,
          value: pullRequest
        }))
    }
  },
  execute: (_context, pullRequest) => {
    if (!pullRequest) return

    const navigate = getNavigate()

    navigate(`/pull-requests/${pullRequest.id}`)
  }
})
