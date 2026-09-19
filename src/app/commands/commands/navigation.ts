import {
  ArrowRight,
  ChevronDown,
  ChevronUp,
  GitPullRequest,
  Home,
  PanelLeft
} from 'lucide-react'

import { commandRegistry } from '../registry'
import { getNavigate } from '../context'
import { pullRequestPath } from '@/app/pull-requests/pull-request-path'
import { getPullRequestNavigation } from '../pr-navigation-accessor'
import { getSidebarNavigation, maximumJumpShortcuts } from '../sidebar-accessor'
import { getStore } from '../store-accessor'
import type { PullRequest } from '@/types/pull-request'

// Tab names as used in the app
const tabs = ['overview', 'tasks', 'checks', 'files'] as const

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

      const navigation = getPullRequestNavigation()

      if (navigation) {
        navigation.setActiveTab(ctx.pullRequest.id, tab)
        return
      }

      const navigate = getNavigate()
      navigate(`/pull-requests/${ctx.pullRequest.id}?tab=${tab}`)
    }
  })
})

// Landmark jump commands (j/k on PR detail view)
commandRegistry.register({
  id: 'navigation.landmark-next',
  label: 'Jump To Next Section',
  icon: ChevronDown,
  group: 'navigation',
  shortcut: { key: 'j' },
  isAvailable: (ctx) => ctx.view === 'pr-detail',
  execute: () => {
    const navigation = getPullRequestNavigation()

    navigation?.jumpToNextLandmark()
  }
})

commandRegistry.register({
  id: 'navigation.landmark-previous',
  label: 'Jump To Previous Section',
  icon: ChevronUp,
  group: 'navigation',
  shortcut: { key: 'k' },
  isAvailable: (ctx) => ctx.view === 'pr-detail',
  execute: () => {
    const navigation = getPullRequestNavigation()

    navigation?.jumpToPreviousLandmark()
  }
})

// Sidebar navigation (shift+j / shift+k). These deliberately avoid plain j/k,
// which move between landmarks inside the open pull request. Alt is not an
// option: macOS turns alt+j into a dead key, so the shortcut never matches.
commandRegistry.register({
  id: 'navigation.next-pull-request',
  label: 'Go To Next Pull Request',
  icon: PanelLeft,
  group: 'navigation',
  shortcut: { key: 'j', shift: true },
  isAvailable: () => getSidebarNavigation() !== null,
  execute: () => {
    getSidebarNavigation()?.selectNext()
  }
})

commandRegistry.register({
  id: 'navigation.previous-pull-request',
  label: 'Go To Previous Pull Request',
  icon: PanelLeft,
  group: 'navigation',
  shortcut: { key: 'k', shift: true },
  isAvailable: () => getSidebarNavigation() !== null,
  execute: () => {
    getSidebarNavigation()?.selectPrevious()
  }
})

// Jump straight to the Nth pull request in the sidebar (mod+1 .. mod+9).
// `mod` resolves to Cmd on macOS and Ctrl elsewhere, so this covers both. Only
// 1-9: Electron's default menu binds mod+0 to resetZoom. These do not collide
// with the plain 1-4 tab shortcuts because `matchesShortcut` compares every
// modifier strictly.
for (let position = 1; position <= maximumJumpShortcuts; position++) {
  commandRegistry.register({
    id: `navigation.jump-to-pull-request-${position.toString()}`,
    icon: PanelLeft,
    label: `Go To Pull Request ${position.toString()}`,
    group: 'navigation',
    shortcut: { key: position.toString(), mod: true },
    isAvailable: () => getSidebarNavigation() !== null,
    execute: () => {
      getSidebarNavigation()?.selectIndex(position - 1)
    }
  })
}

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

    navigate(
      pullRequestPath(
        pullRequest.id,
        getPullRequestNavigation()?.getActiveTab()
      )
    )
  }
})
