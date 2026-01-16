import { ArrowRight, Home } from 'lucide-react'

import { commandRegistry } from '../registry'
import { getNavigate } from '../context'

// Tab names as used in the app
const tabs = ['overview', 'commits', 'checks', 'files'] as const

// Tab navigation commands (1-4 keys on PR detail view)
tabs.forEach((tab, index) => {
  commandRegistry.register({
    id: `navigation.tab-${tab}`,
    icon: ArrowRight,
    label: `Go to ${tab.charAt(0).toUpperCase() + tab.slice(1)} tab`,
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
  label: 'Go to home',
  icon: Home,
  group: 'navigation',
  shortcut: { key: 'h', mod: true },
  isAvailable: (ctx) => ctx.view !== 'home',
  execute: () => {
    const navigate = getNavigate()
    navigate('/')
  }
})
