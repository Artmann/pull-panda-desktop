import { useEffect, useRef } from 'react'
import { ArrowLeft } from 'lucide-react'

import { Input } from '../components/ui/input'
import { getPlaceholder } from './command-palette-utils'
import { CommandPaletteResults } from './CommandPaletteResults'
import { Command } from './types'
import {
  useCommandPalette,
  useCommandPaletteHotkeys
} from './use-command-palette'

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
  const palette = useCommandPalette()
  const inputRef = useRef<HTMLInputElement>(null)

  const { activeCommand, closePalette, mode, open, openWithCommand, setOpen } =
    palette

  useEffect(() => {
    setCommandPaletteOpenExternal = setOpen
    openWithCommandExternal = openWithCommand

    return () => {
      setCommandPaletteOpenExternal = null
      openWithCommandExternal = null
    }
  }, [setOpen, openWithCommand])

  useEffect(() => {
    if (open) {
      inputRef.current?.focus()
    }
  }, [open])

  useCommandPaletteHotkeys(palette)

  return (
    <div
      className="fixed inset-0 z-50 flex justify-center pt-[15vh] pb-4 px-4"
      style={{ display: open ? 'flex' : 'none' }}
      onClick={closePalette}
    >
      <div
        className="bg-background w-180 h-112.5 rounded-md shadow-md border border-border flex flex-col"
        onClick={(event) => event.stopPropagation()}
      >
        {mode === 'params' && activeCommand && (
          <ParamsHeader
            label={activeCommand.label}
            onBack={palette.resetPalette}
          />
        )}

        <div className="px-4 border-b border-border py-1">
          <Input
            ref={inputRef}
            className="px-0 border-none focus:ring-0 focus-visible:ring-0 shadow-none"
            placeholder={getPlaceholder(mode, activeCommand)}
            value={palette.query}
            onChange={(event) => palette.updateQuery(event.target.value)}
          />
        </div>

        <div className="flex-1 min-h-0 pb-2 px-2 overflow-y-auto">
          <CommandPaletteResults
            commandGroups={palette.commandGroups}
            filteredCommands={palette.filteredCommands}
            isSearching={palette.isSearching}
            mode={mode}
            onHover={palette.setSelectedId}
            onSelectCommand={palette.selectCommand}
            onSelectOption={palette.selectOption}
            paramOptions={palette.paramOptions}
            selectedId={palette.selectedId}
          />
        </div>
      </div>
    </div>
  )
}

function ParamsHeader({
  label,
  onBack
}: {
  label: string
  onBack: () => void
}) {
  return (
    <div className="px-3 py-3 border-b border-border flex items-center gap-1">
      <button
        className="p-0.5 hover:bg-muted rounded-md"
        onClick={onBack}
        type="button"
      >
        <ArrowLeft className="size-3 text-muted-foreground" />
      </button>
      <span className="text-sm">{label}</span>
    </div>
  )
}
