import { toast } from 'sonner'

import { triggerSync } from '@/app/lib/api'

import { commandRegistry } from '../registry'

// Command palette command (handled by CommandPalette component directly)
// This is registered so it appears in the palette's command list
commandRegistry.register({
  id: 'app.command-palette',
  label: 'Open command palette',
  group: 'app',
  shortcut: { key: 'k', mod: true },
  isAvailable: () => true,
  execute: () => {
    // Handled by CommandPalette's own keydown listener
  }
})

// Sync pull requests command
commandRegistry.register({
  id: 'app.sync',
  label: 'Sync pull requests',
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
