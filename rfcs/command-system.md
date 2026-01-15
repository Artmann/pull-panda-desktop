# RFC: Command System

**Status:** Accepted  
**Author:** Chris  
**Created:** January 2026

## Summary

This RFC proposes a unified command system for Pull Panda that powers keyboard
shortcuts, the command palette, and UI-triggered actions through a single
abstraction. Commands are context-aware, discoverable, and extensible.

## Motivation

Pull Panda needs to support multiple ways of triggering the same actions:

1. **Keyboard shortcuts** - Power users expect to navigate and act without
   touching the mouse. Quick switching between PRs with number keys, starting a
   review with a single keystroke, etc.

2. **Command palette** - A searchable dialog (triggered by Cmd+K) that exposes
   all available actions. This helps users discover functionality and access
   less-frequent commands without memorizing shortcuts.

3. **UI interactions** - Clicking buttons, cards, and menu items should trigger
   the same underlying actions.

Without a unified system, we'd end up with duplicated logic across click
handlers, keyboard listeners, and palette items. A command system gives us one
source of truth for what actions exist, when they're available, and what they
do.

## Design Goals

**Contextual** - Commands should only appear when they make sense. "Submit
review" shouldn't show up on the dashboard. "Go to PR #3" shouldn't appear when
there are only 2 PRs visible.

**Discoverable** - Users should be able to find commands through the palette
without prior knowledge. Grouping, labels, and search all contribute to this.

**Consistent** - The same action should work the same way whether triggered by
shortcut, palette, or click.

**Extensible** - Adding new commands should be straightforward. View-specific
commands should be defined alongside their views, not in a central file.

## Detailed Design

### Core Types

```typescript
type CommandContext = {
  view: 'home' | 'pr-detail' | 'other'
  selectedPr?: PullRequest
  selectedFile?: FileChange
  selectedComment?: Comment
}

type CommandGroup = 'navigation' | 'review' | 'view' | 'pr-actions' | 'app'

type Command = {
  id: string
  label: string
  group: CommandGroup
  icon?: IconName
  shortcut?: Shortcut
  isAvailable: (context: CommandContext) => boolean
  execute: (context: CommandContext) => void | Promise<void>
}

type Shortcut = {
  key: string
  mod?: boolean // Cmd on Mac, Ctrl on Windows/Linux
  shift?: boolean
  alt?: boolean
}
```

### Command Registry

The registry is the central store for all commands. It handles registration,
lookup, and filtering by context.

```typescript
class CommandRegistry {
  private commands: Map<string, Command> = new Map()

  register(command: Command): void
  unregister(id: string): void

  getById(id: string): Command | undefined

  listAvailable(context: CommandContext): Command[]
  listByGroup(context: CommandContext): Map<CommandGroup, Command[]>

  findByShortcut(shortcut: Shortcut): Command | undefined
}
```

Commands register themselves, typically at module load time:

```typescript
// In pr-detail-view.tsx or a nearby commands file
commandRegistry.register({
  id: 'review.start',
  label: 'Start review',
  group: 'review',
  icon: 'play',
  shortcut: { key: 'r' },
  isAvailable: (ctx) =>
    ctx.view === 'pr-detail' && !ctx.selectedPr?.hasActiveReview,
  execute: (ctx) => reviewStore.startReview(ctx.selectedPr!.id)
})
```

### Context Provider

A React context tracks the current command context and provides it to the
palette and shortcut listener. The context is derived from React Router's
current location and Redux state rather than being set explicitly by views.

```typescript
type CommandContextValue = {
  context: CommandContext
  setSelectedFile: (file: FileChange | undefined) => void
  setSelectedComment: (comment: Comment | undefined) => void
}

function CommandContextProvider({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  const { id } = useParams<{ id: string }>()

  const selectedPr = useAppSelector(state =>
    id ? state.pullRequestDetails[id] : undefined
  )

  const view = useMemo(() => {
    if (location.pathname.startsWith('/pull-requests/')) return 'pr-detail'
    if (location.pathname === '/') return 'home'
    return 'other'
  }, [location.pathname])

  const [selectedFile, setSelectedFile] = useState<FileChange>()
  const [selectedComment, setSelectedComment] = useState<Comment>()

  const context: CommandContext = {
    view,
    selectedPr,
    selectedFile,
    selectedComment,
  }

  return (
    <CommandContext.Provider value={{ context, setSelectedFile, setSelectedComment }}>
      {children}
    </CommandContext.Provider>
  )
}
```

File and comment selection are set explicitly when the user interacts with those
elements:

```typescript
function FileTreeItem({ file }: { file: FileChange }) {
  const { setSelectedFile } = useCommandContext()

  return (
    <div
      onClick={() => setSelectedFile(file)}
      onBlur={() => setSelectedFile(undefined)}
    >
      {file.filename}
    </div>
  )
}
```

### Shortcut Listener

A global keyboard listener that intercepts shortcuts and executes matching
commands.

```typescript
function ShortcutListener() {
  const { context } = useCommandContext()

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      // Ignore if user is typing in an input
      if (isInputFocused()) return

      const shortcut = eventToShortcut(event)
      const command = commandRegistry.findByShortcut(shortcut)

      if (command && command.isAvailable(context)) {
        event.preventDefault()
        command.execute(context)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [context])

  return null
}
```

### Command Palette

The palette is a dialog that lists available commands, supports search, and
shows shortcuts.

```typescript
function CommandPalette() {
  const { context } = useCommandContext()
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')

  // Mod+K to open (Cmd on Mac, Ctrl on Windows/Linux)
  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const modKey = event.metaKey || event.ctrlKey
      if (event.key === 'k' && modKey) {
        event.preventDefault()
        setOpen(true)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const commandsByGroup = commandRegistry.listByGroup(context)
  const filtered = filterBySearch(commandsByGroup, search)

  function handleSelect(command: Command) {
    setOpen(false)
    setSearch('')
    command.execute(context)
  }

  // Render dialog with grouped command list...
}
```

### Context Header

When a PR is selected, the palette shows it at the top (like Linear does).
Commands in this state operate on that PR.

```typescript
function PaletteHeader({ context }: { context: CommandContext }) {
  if (!context.selectedPr) return null

  return (
    <div className="palette-context">
      <span className="pr-number">#{context.selectedPr.number}</span>
      <span className="pr-title">{context.selectedPr.title}</span>
    </div>
  )
}
```

### Commands with Arguments

Some commands need additional input, like "Go to PR..." which needs a PR number.
These commands open a sub-dialog or inline input.

```typescript
commandRegistry.register({
  id: 'navigation.goto-pr',
  label: 'Go to PR...',
  group: 'navigation',
  shortcut: { key: 'p', mod: true },
  isAvailable: () => true,
  execute: () => {
    // This triggers a mode in the palette where it shows a PR picker
    // or accepts typed input like "#123"
    paletteStore.setMode('pr-picker')
  }
})
```

The palette handles different modes:

```typescript
type PaletteMode =
  | { type: 'commands' }
  | { type: 'pr-picker' }
  | { type: 'user-picker'; onSelect: (user: User) => void }
  | { type: 'status-picker'; onSelect: (status: ReviewStatus) => void }
```

### Triggering Commands from UI

UI components can trigger commands directly:

```typescript
function PrCard({ pr }: { pr: PullRequest }) {
  const { context } = useCommandContext()

  function handleClick() {
    const command = commandRegistry.getById('navigation.open-pr')
    if (command) {
      command.execute({ ...context, selectedPr: pr })
    }
  }

  return <div onClick={handleClick}>...</div>
}
```

Or through a helper hook:

```typescript
function useCommand(id: string) {
  const { context } = useCommandContext()
  const command = commandRegistry.getById(id)

  const execute = useCallback((contextOverrides?: Partial<CommandContext>) => {
    if (command?.isAvailable({ ...context, ...contextOverrides })) {
      command.execute({ ...context, ...contextOverrides })
    }
  }, [command, context])

  const isAvailable = command?.isAvailable(context) ?? false

  return { execute, isAvailable, shortcut: command?.shortcut }
}

// Usage
function PrCard({ pr }: { pr: PullRequest }) {
  const { execute } = useCommand('navigation.open-pr')
  return <div onClick={() => execute({ selectedPr: pr })}>...</div>
}
```

### Redux Integration

Commands often need to check or modify Redux state. Since commands are defined
outside of React components, they access the store directly:

```typescript
import { store } from '@/app/store'
import { pendingReviewsActions } from '@/app/store/pending-reviews-slice'

commandRegistry.register({
  id: 'review.start',
  label: 'Start review',
  group: 'review',
  shortcut: { key: 'r' },
  isAvailable: (ctx) => {
    if (ctx.view !== 'pr-detail' || !ctx.selectedPr) return false
    const state = store.getState()
    return !state.pendingReviews[ctx.selectedPr.id]
  },
  execute: (ctx) => {
    store.dispatch(
      pendingReviewsActions.set({
        pullRequestId: ctx.selectedPr!.id
      })
    )
  }
})
```

For navigation commands, use React Router's navigate function. The command
registry can hold a reference to it:

```typescript
// Set by CommandContextProvider on mount
let navigate: NavigateFunction

export function setNavigate(nav: NavigateFunction) {
  navigate = nav
}

commandRegistry.register({
  id: 'navigation.home',
  label: 'Go to home',
  group: 'navigation',
  shortcut: { key: 'g', then: 'h' },
  isAvailable: () => true,
  execute: () => navigate('/')
})
```

## Implementation Notes

### Prerequisites

Install the shadcn/ui Command component (built on cmdk):

```bash
npx shadcn@latest add command
```

### File Structure

```
src/app/commands/
├── index.ts              # Re-exports registry and types
├── types.ts              # Command, CommandContext, Shortcut types
├── registry.ts           # CommandRegistry implementation
├── context.tsx           # CommandContextProvider
├── ShortcutListener.tsx  # Global keyboard handler
├── CommandPalette.tsx    # Palette UI using shadcn Command
└── commands/
    ├── navigation.ts     # Navigation commands
    ├── review.ts         # Review commands
    ├── pr-actions.ts     # PR action commands
    └── view.ts           # View toggle commands
```

### Platform Detection

For displaying shortcuts in the UI, detect the platform:

```typescript
const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0

function formatShortcut(shortcut: Shortcut): string {
  const parts: string[] = []
  if (shortcut.mod) parts.push(isMac ? '⌘' : 'Ctrl')
  if (shortcut.shift) parts.push(isMac ? '⇧' : 'Shift')
  if (shortcut.alt) parts.push(isMac ? '⌥' : 'Alt')
  parts.push(shortcut.key.toUpperCase())
  return parts.join(isMac ? '' : '+')
}
```

## Command Reference

### Global Commands

| ID                    | Label                | Shortcut | Group      |
| --------------------- | -------------------- | -------- | ---------- |
| `navigation.home`     | Go to home           | G then H | navigation |
| `navigation.goto-pr`  | Go to PR...          | Mod+P    | navigation |
| `app.command-palette` | Open command palette | Mod+K    | app        |
| `app.sync`            | Sync pull requests   | Shift+R  | app        |
| `app.theme-light`     | Switch to light mode |          | app        |
| `app.theme-dark`      | Switch to dark mode  |          | app        |
| `app.theme-system`    | Use system theme     |          | app        |

### Home View Commands

| ID                    | Label     | Shortcut | Group      |
| --------------------- | --------- | -------- | ---------- |
| `home.quick-switch-1` | Open PR 1 | 1        | navigation |
| `home.quick-switch-2` | Open PR 2 | 2        | navigation |
| `home.quick-switch-3` | Open PR 3 | 3        | navigation |
| ...                   | ...       | 4-9      | navigation |

### PR Detail Commands

| ID                        | Label              | Shortcut    | Group      |
| ------------------------- | ------------------ | ----------- | ---------- |
| `review.start`            | Start review       | R           | review     |
| `review.submit`           | Submit review      | Mod+Enter   | review     |
| `review.approve`          | Approve            |             | review     |
| `review.request-changes`  | Request changes    |             | review     |
| `pr.open-in-github`       | Open in GitHub     | O           | pr-actions |
| `pr.copy-link`            | Copy link          | Mod+Shift+C | pr-actions |
| `pr.copy-branch`          | Copy branch name   |             | pr-actions |
| `navigation.tab-overview` | Go to Overview tab | 1           | navigation |
| `navigation.tab-commits`  | Go to Commits tab  | 2           | navigation |
| `navigation.tab-checks`   | Go to Checks tab   | 3           | navigation |
| `navigation.tab-files`    | Go to Files tab    | 4           | navigation |
| `navigation.next-file`    | Next file          | J           | navigation |
| `navigation.prev-file`    | Previous file      | K           | navigation |
| `view.expand-all`         | Expand all files   | Shift+E     | view       |
| `view.collapse-all`       | Collapse all files | Shift+C     | view       |

## Alternatives Considered

### Single Global Store vs Distributed Registration

We could define all commands in a single file instead of having each module
register its own. This would be simpler initially but harder to maintain as the
app grows. The distributed approach keeps related code together.

### Event-Based vs Direct Execution

An alternative would be to have commands emit events that other parts of the app
listen to. This adds indirection without clear benefit for our use case. Direct
execution is simpler and easier to debug.

### Using an Existing Library

Libraries like `cmdk` (which powers shadcn/ui's Command component) handle the
palette UI well. We should use it for the presentation layer. However, we still
need our own registry and context system since these libraries don't handle the
"when is a command available" logic.

## References

- Linear's command palette implementation
- VS Code's command system
- shadcn/ui Command component (built on cmdk)
