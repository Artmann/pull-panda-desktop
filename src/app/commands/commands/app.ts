import { RefreshCw, Search } from 'lucide-react'
import { toast } from 'sonner'

import { triggerSync } from '@/app/lib/api'

import { commandRegistry } from '../registry'

// Command palette command (handled by CommandPalette component directly)
// Hidden from the palette since you're already in it
commandRegistry.register({
  id: 'app.command-palette',
  label: 'Open Command Palette',
  icon: Search,
  group: 'app',
  shortcut: { key: 'k', mod: true },
  isAvailable: () => false,
  execute: () => {
    // Handled by CommandPalette's own keydown listener
  }
})

// Sync pull requests command
commandRegistry.register({
  id: 'app.sync',
  label: 'Sync Pull Requests',
  icon: RefreshCw,
  group: 'app',
  shortcut: { key: 'r', shift: true },
  isAvailable: () => true,
  execute: async () => {
    try {
      await triggerSync()
      toast.success('Sync started')
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to trigger sync'
      toast.error(message)
    }
  }
})
