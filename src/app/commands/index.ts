// Export types
export type {
  Command,
  CommandContext,
  CommandGroup,
  CommandView,
  Shortcut
} from './types'

// Export registry
export { commandRegistry } from './registry'

// Export context
export {
  CommandContextProvider,
  useCommandContext,
  getNavigate
} from './context'

// Export components
export { ShortcutListener } from './ShortcutListener'
export {
  CommandPalette,
  openCommandPalette,
  closeCommandPalette
} from './CommandPalette'

// Export utilities
export { formatShortcut, isMac } from './utils'

// Register all commands by importing them
import './commands'
