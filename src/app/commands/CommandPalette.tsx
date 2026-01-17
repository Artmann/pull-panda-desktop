import { useState, useEffect, useCallback, useRef, useMemo } from 'react'
import { useHotkeys } from 'react-hotkeys-hook'
import { ArrowLeft } from 'lucide-react'

import { Input } from '../components/ui/input'
import { useCommandContext } from './context'
import { commandRegistry } from './registry'
import { Command, CommandOption } from './types'
import { cn } from '../lib/utils'
import { isMac } from './utils'

type PaletteMode = 'commands' | 'params'

// Store setters for external access
let setCommandPaletteOpenExternal: ((open: boolean) => void) | null = null
let openWithCommandExternal: ((command: Command) => void) | null = null

export function openCommandPalette() {
  setCommandPaletteOpenExternal?.(true)
}

export function closeCommandPalette() {
  setCommandPaletteOpenExternal?.(false)
}

export function openCommandPaletteWithCommand(command: Command) {
  openWithCommandExternal?.(command)
}

export function CommandPalette() {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<PaletteMode>('commands')
  const [query, setQuery] = useState('')
  const [activeCommand, setActiveCommand] = useState<Command | null>(null)
  const [selectedId, setSelectedId] = useState<string | undefined>()
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

  // Get options for parameterized command
  const paramOptions = useMemo(() => {
    if (mode !== 'params' || !activeCommand?.param) return []

    return activeCommand.param.getOptions(context, query)
  }, [mode, activeCommand, context, query])

  const updateQuery = useCallback((value: string) => {
    setQuery(value)
    setSelectedId(undefined)
  }, [])

  const resetPalette = useCallback(() => {
    setMode('commands')
    setActiveCommand(null)
    setQuery('')
    setSelectedId(undefined)
  }, [])

  const goBack = useCallback(() => {
    setMode('commands')
    setActiveCommand(null)
    setQuery('')
    setSelectedId(undefined)
  }, [])

  const setOpenCallback = useCallback((value: boolean) => {
    setOpen(value)
  }, [])

  const handleSelectCommand = useCallback(
    (command: Command) => {
      if (command.param) {
        // Parameterized command - switch to params mode
        setMode('params')
        setActiveCommand(command)
        setQuery('')
        setSelectedId(undefined)
      } else {
        // Regular command - execute immediately
        command.execute(context)
        setOpen(false)
        resetPalette()
      }
    },
    [context, resetPalette]
  )

  const handleSelectOption = useCallback(
    (option: CommandOption) => {
      if (!activeCommand) return

      activeCommand.execute(context, option.value)
      setOpen(false)
      resetPalette()
    },
    [activeCommand, context, resetPalette]
  )

  const handleClickCommand = useCallback(
    (command: Command) => {
      return () => handleSelectCommand(command)
    },
    [handleSelectCommand]
  )

  const handleClickOption = useCallback(
    (option: CommandOption) => {
      return () => handleSelectOption(option)
    },
    [handleSelectOption]
  )

  const openWithCommand = useCallback((command: Command) => {
    if (command.param) {
      setOpen(true)
      setMode('params')
      setActiveCommand(command)
      setQuery('')
      setSelectedId(undefined)
    }
  }, [])

  useEffect(() => {
    setCommandPaletteOpenExternal = setOpenCallback
    openWithCommandExternal = openWithCommand

    return () => {
      setCommandPaletteOpenExternal = null
      openWithCommandExternal = null
    }
  }, [setOpenCallback, openWithCommand])

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

  // Escape to close or go back
  useHotkeys(
    'escape',
    (event) => {
      event.preventDefault()

      if (mode === 'params') {
        goBack()
      } else {
        setOpen(false)
        resetPalette()
      }
    },
    { enabled: open, enableOnFormTags: ['INPUT'] }
  )

  useHotkeys(
    'arrowup',
    (event) => {
      event.preventDefault()

      const items = mode === 'params' ? paramOptions : filteredCommands

      if (items.length === 0) return

      const currentIndex = items.findIndex((item) => item.id === selectedId)
      const nextIndex = currentIndex <= 0 ? items.length - 1 : currentIndex - 1

      setSelectedId(items[nextIndex].id)
    },
    { enabled: open, enableOnFormTags: ['INPUT'] }
  )

  useHotkeys(
    'arrowdown',
    (event) => {
      event.preventDefault()

      const items = mode === 'params' ? paramOptions : filteredCommands

      if (items.length === 0) return

      const currentIndex = items.findIndex((item) => item.id === selectedId)
      const nextIndex =
        currentIndex === -1 || currentIndex === items.length - 1
          ? 0
          : currentIndex + 1

      setSelectedId(items[nextIndex].id)
    },
    { enabled: open, enableOnFormTags: ['INPUT'] }
  )

  useHotkeys(
    'enter',
    (event) => {
      event.preventDefault()

      if (!selectedId) return

      if (mode === 'params') {
        const option = paramOptions.find((opt) => opt.id === selectedId)

        if (option) {
          handleSelectOption(option)
        }
      } else {
        const command = commandRegistry.getById(selectedId)

        if (command) {
          handleSelectCommand(command)
        }
      }
    },
    { enabled: open, enableOnFormTags: ['INPUT'] }
  )

  const placeholder =
    mode === 'params' && activeCommand?.param?.placeholder
      ? activeCommand.param.placeholder
      : 'Type a command or search...'

  return (
    <div
      className="fixed inset-0 z-50 flex justify-center pt-[15vh] pb-4 px-4"
      style={{ display: open ? 'flex' : 'none' }}
      onClick={() => {
        setOpen(false)
        resetPalette()
      }}
    >
      <div
        className="bg-background w-180 h-112.5 rounded-md shadow-md border border-border flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {mode === 'params' && activeCommand && (
          <div className="px-3 py-3 border-b border-border flex items-center gap-1">
            <button
              className="p-0.5 hover:bg-muted rounded-md"
              onClick={goBack}
              type="button"
            >
              <ArrowLeft className="size-3 text-muted-foreground" />
            </button>
            <span className="text-sm">{activeCommand.label}</span>
          </div>
        )}

        <div className="px-4 border-b border-border py-1">
          <Input
            ref={inputRef}
            className="px-0 border-none focus:ring-0 focus-visible:ring-0 shadow-none"
            placeholder={placeholder}
            value={query}
            onChange={(e) => updateQuery(e.target.value)}
          />
        </div>

        <div className="flex-1 min-h-0 pb-2 px-2 overflow-y-auto">
          {mode === 'params' ? (
            <div className="pt-2">
              {paramOptions.length === 0 ? (
                <div className="px-2 py-4 text-center text-muted-foreground text-sm">
                  No results found
                </div>
              ) : (
                paramOptions.map((option) => (
                  <OptionItem
                    key={option.id}
                    option={option}
                    isSelected={option.id === selectedId}
                    onMouseEnter={() => setSelectedId(option.id)}
                    onClick={handleClickOption(option)}
                  />
                ))
              )}
            </div>
          ) : isSearching ? (
            <div>
              {filteredCommands.map((command) => (
                <CommandItem
                  key={command.id}
                  command={command}
                  isSelected={command.id === selectedId}
                  showGroup={true}
                  onMouseEnter={() => setSelectedId(command.id)}
                  onClick={handleClickCommand(command)}
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
                        isSelected={command.id === selectedId}
                        onMouseEnter={() => setSelectedId(command.id)}
                        onClick={handleClickCommand(command)}
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

function OptionItem({
  option,
  isSelected,
  onClick,
  onMouseEnter
}: {
  option: CommandOption
  isSelected?: boolean
  onClick?: () => void
  onMouseEnter?: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const Icon = option.icon

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
      {Icon && <Icon className="size-3 text-muted-foreground mr-0.5" />}

      <div className="flex-1 min-w-0">
        <div className="truncate">{option.label}</div>

        {option.description && (
          <div className="text-xs text-muted-foreground truncate">
            {option.description}
          </div>
        )}
      </div>
    </div>
  )
}
