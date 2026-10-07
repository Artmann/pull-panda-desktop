import { useCallback, useMemo, useState } from 'react'
import { useHotkeys, type Options } from 'react-hotkeys-hook'

import {
  getAdjacentId,
  groupCommands,
  type PaletteMode
} from './command-palette-utils'
import { useCommandContext } from './context'
import { commandRegistry } from './registry'
import type { Command, CommandOption } from './types'

type CommandPaletteState = ReturnType<typeof useCommandPalette>

export function useCommandPalette() {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<PaletteMode>('commands')
  const [query, setQuery] = useState('')
  const [activeCommand, setActiveCommand] = useState<Command | null>(null)
  const [selectedId, setSelectedId] = useState<string | undefined>()

  const { context } = useCommandContext()

  const commandGroups = groupCommands(
    commandRegistry.listAvailable(context),
    query
  )
  const filteredCommands = Array.from(commandGroups.values()).flat()

  const paramOptions = useMemo(
    () =>
      mode === 'params' && activeCommand?.param
        ? activeCommand.param.getOptions(context, query)
        : [],
    [mode, activeCommand, context, query]
  )

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

  const showParams = useCallback((command: Command) => {
    setMode('params')
    setActiveCommand(command)
    setQuery('')
    setSelectedId(undefined)
  }, [])

  const closePalette = useCallback(() => {
    setOpen(false)
    resetPalette()
  }, [resetPalette])

  const selectCommand = useCallback(
    (command: Command) => {
      if (command.param) {
        showParams(command)

        return
      }

      void command.execute(context)
      closePalette()
    },
    [closePalette, context, showParams]
  )

  const selectOption = useCallback(
    (option: CommandOption) => {
      if (!activeCommand) {
        return
      }

      void activeCommand.execute(context, option.value)
      closePalette()
    },
    [activeCommand, closePalette, context]
  )

  const openWithCommand = useCallback(
    (command: Command) => {
      if (command.param) {
        setOpen(true)
        showParams(command)
      }
    },
    [showParams]
  )

  return {
    activeCommand,
    closePalette,
    commandGroups,
    filteredCommands,
    isSearching: query.trim().length > 2,
    mode,
    open,
    openWithCommand,
    paramOptions,
    query,
    resetPalette,
    selectCommand,
    selectedId,
    selectOption,
    setOpen,
    setSelectedId,
    updateQuery
  }
}

function confirmSelection(palette: CommandPaletteState) {
  const { mode, paramOptions, selectCommand, selectedId, selectOption } =
    palette

  if (!selectedId) {
    return
  }

  if (mode === 'params') {
    const option = paramOptions.find((item) => item.id === selectedId)

    if (option) {
      selectOption(option)
    }

    return
  }

  const command = commandRegistry.getById(selectedId)

  if (command) {
    selectCommand(command)
  }
}

export function useCommandPaletteHotkeys(palette: CommandPaletteState) {
  const {
    closePalette,
    filteredCommands,
    mode,
    open,
    paramOptions,
    resetPalette,
    selectedId,
    setOpen,
    setSelectedId
  } = palette
  const options: Options = { enabled: open, enableOnFormTags: ['INPUT'] }

  const moveSelection = (event: KeyboardEvent, direction: 'down' | 'up') => {
    event.preventDefault()

    const items = mode === 'params' ? paramOptions : filteredCommands
    const nextId = getAdjacentId(items, selectedId, direction)

    if (nextId) {
      setSelectedId(nextId)
    }
  }

  // Mod+K to toggle
  useHotkeys('mod+k', (event) => {
    event.preventDefault()
    setOpen((previous) => !previous)
  })

  // Escape to close or go back
  useHotkeys(
    'escape',
    (event) => {
      event.preventDefault()

      if (mode === 'params') {
        resetPalette()
      } else {
        closePalette()
      }
    },
    options
  )

  useHotkeys('arrowup', (event) => moveSelection(event, 'up'), options)

  useHotkeys('arrowdown', (event) => moveSelection(event, 'down'), options)

  useHotkeys(
    'enter',
    (event) => {
      event.preventDefault()
      confirmSelection(palette)
    },
    options
  )
}
