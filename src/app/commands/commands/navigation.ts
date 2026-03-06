import { ArrowRight, GitPullRequest, Home } from 'lucide-react'

import { getQueryClient } from '@/app/lib/query-client-accessor'
import { queryKeys } from '@/app/lib/query-keys'
import type { PullRequest } from '@/types/pull-request'

import { commandRegistry } from '../registry'
import { getNavigate } from '../context'

// Tab names as used in the app
const tabs = ['overview', 'checks', 'files'] as const

// Tab navigation commands (1-3 keys on PR detail view)
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
      const queryClient = getQueryClient()
      const pullRequests =
        queryClient.getQueryData<PullRequest[]>(queryKeys.pullRequests.all) ??
        []

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
