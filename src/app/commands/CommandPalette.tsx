import { useState, useEffect, useCallback, useRef } from 'react'
import { useHotkeys } from 'react-hotkeys-hook'

import { Input } from '../components/ui/input'
import { useCommandContext } from './context'
import { commandRegistry } from './registry'
import { Command } from './types'
import { cn } from '../lib/utils'
import { isMac } from './utils'

// Store the open state setter for external access
let setCommandPaletteOpenExternal: ((open: boolean) => void) | null = null

export function openCommandPalette() {
  setCommandPaletteOpenExternal?.(true)
}

export function closeCommandPalette() {
  setCommandPaletteOpenExternal?.(false)
}

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selectedCommandId, setSelectedCommandId] = useState<
    string | undefined
  >()
  const inputRef = useRef<HTMLInputElement>(null)

  const { context } = useCommandContext()

  const availableCommands = commandRegistry.listAvailable(context)

  const hasQuery = query.trim().length > 0
  const isSearching = query.trim().length > 2

  const filteredCommands = hasQuery
    ? availableCommands.filter((command) =>
        command.label.toLowerCase().includes(query.toLowerCase())
      )
    : availableCommands

  const filteredCommandsByGroup = new Map<string, Command[]>()

  for (const command of filteredCommands) {
    const group = command.group || 'other'

    if (!filteredCommandsByGroup.has(group)) {
      filteredCommandsByGroup.set(group, [])
    }

    filteredCommandsByGroup.get(group).push(command)
  }

  const updateQuery = useCallback((value: string) => {
    setQuery(value)
    setSelectedCommandId(undefined)
  }, [])

  const setOpenCallback = useCallback((value: boolean) => {
    setOpen(value)
  }, [])

  const handleClickItem = useCallback(
    (command: Command) => {
      return () => {
        command.execute(context)
        setOpen(false)
        setQuery('')
      }
    },
    [context]
  )

  useEffect(() => {
    setCommandPaletteOpenExternal = setOpenCallback
    return () => {
      setCommandPaletteOpenExternal = null
    }
  }, [setOpenCallback])

  useEffect(() => {
    if (open) {
      inputRef.current?.focus()
    }
  }, [open])

  // Mod+K to toggle
  useHotkeys('mod+k', (event) => {
    event.preventDefault()
    setOpen((prev) => !prev)
  })

  // Escape to close
  useHotkeys(
    'escape',
    (event) => {
      event.preventDefault()
      setOpen(false)
    },
    { enabled: open, enableOnFormTags: ['INPUT'] }
  )

  useHotkeys(
    'arrowup',
    (event) => {
      event.preventDefault()

      if (filteredCommands.length === 0) {
        return
      }

      const currentIndex = filteredCommands.findIndex(
        (cmd) => cmd.id === selectedCommandId
      )
      const nextIndex =
        currentIndex <= 0 ? filteredCommands.length - 1 : currentIndex - 1

      setSelectedCommandId(filteredCommands[nextIndex].id)
    },
    { enabled: open, enableOnFormTags: ['INPUT'] }
  )

  useHotkeys(
    'arrowdown',
    (event) => {
      event.preventDefault()

      if (filteredCommands.length === 0) {
        return
      }

      const currentIndex = filteredCommands.findIndex(
        (cmd) => cmd.id === selectedCommandId
      )
      const nextIndex =
        currentIndex === -1 || currentIndex === filteredCommands.length - 1
          ? 0
          : currentIndex + 1

      setSelectedCommandId(filteredCommands[nextIndex].id)
    },
    { enabled: open, enableOnFormTags: ['INPUT'] }
  )

  useHotkeys(
    'enter',
    (event) => {
      event.preventDefault()

      if (!selectedCommandId) {
        return
      }

      const command = commandRegistry.getById(selectedCommandId)

      if (command) {
        command.execute(context)
        setOpen(false)
        setQuery('')
      }
    },
    { enabled: open, enableOnFormTags: ['INPUT'] }
  )

  return (
    <div
      className="fixed inset-0 z-50 flex justify-center pt-[15vh] pb-4 px-4"
      style={{ display: open ? 'flex' : 'none' }}
      onClick={() => setOpen(false)}
    >
      <div
        className="bg-background w-180 h-112.5 rounded-md shadow-md border border-border flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-4"></div>
        <div className="px-4 border-b border-border py-1">
          <Input
            ref={inputRef}
            className="px-0 border-none focus:ring-0 focus-visible:ring-0 shadow-none"
            placeholder="Type a command or search..."
            value={query}
            onChange={(e) => updateQuery(e.target.value)}
          />
        </div>

        <div className="flex-1 min-h-0 pb-2 px-2 overflow-y-auto">
          {isSearching ? (
            <div>
              {filteredCommands.map((command) => (
                <CommandItem
                  key={command.id}
                  command={command}
                  isSelected={command.id === selectedCommandId}
                  showGroup={true}
                  onMouseEnter={() => setSelectedCommandId(command.id)}
                  onClick={handleClickItem(command)}
                />
              ))}
            </div>
          ) : (
            <div>
              {Array.from(filteredCommandsByGroup.entries()).map(
                ([group, commands]) => (
                  <div key={group}>
                    <div className="px-2 py-2 text-muted-foreground capitalize text-xs">
                      {group}
                    </div>
                    {commands.map((command) => (
                      <CommandItem
                        key={command.id}
                        command={command}
                        isSelected={command.id === selectedCommandId}
                        onMouseEnter={() => setSelectedCommandId(command.id)}
                        onClick={handleClickItem(command)}
                      />
                    ))}
                  </div>
                )
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function CommandItem({
  command,
  showGroup,
  isSelected,
  onClick,
  onMouseEnter
}: {
  command: Command
  showGroup?: boolean
  isSelected?: boolean
  onClick?: () => void
  onMouseEnter?: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const Icon = command.icon

  useEffect(() => {
    if (isSelected && ref.current) {
      ref.current.scrollIntoView({ block: 'nearest' })
    }
  }, [isSelected])

  return (
    <div
      ref={ref}
      className={cn(
        'flex items-center gap-2 px-2 py-2 text-sm rounded-md cursor-pointer',
        isSelected ? 'bg-muted' : 'bg-background'
      )}
      onMouseEnter={onMouseEnter}
      onClick={onClick}
    >
      <div className="flex items-center gap-2 flex-1">
        {Icon && <Icon className="size-3 text-muted-foreground mr-0.5" />}

        <div>{command.label}</div>

        {showGroup && (
          <div className="text-muted-foreground capitalize">
            {command.group}
          </div>
        )}
      </div>

      {command.shortcut && (
        <div className="flex items-center gap-0.5">
          {command.shortcut.mod && (
            <div className="uppercase border border-border text-muted-foreground px-1.5 py-0.5 rounded-sm text-[11px]">
              {isMac() ? '⌘' : 'Ctrl'}
            </div>
          )}
          <div className="uppercase border border-border text-muted-foreground px-1.5 py-0.5 rounded-sm text-[11px]">
            {command.shortcut.key}
          </div>
        </div>
      )}
    </div>
  )
}
