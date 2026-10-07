import { useEffect, useRef, type ReactNode } from 'react'

import { Kbd, modifierKey } from '../components/Kbd'
import type { PaletteMode } from './command-palette-utils'
import type { Command, CommandOption } from './types'
import { cn } from '../lib/utils'

type CommandPaletteResultsProps = {
  commandGroups: Map<string, Command[]>
  filteredCommands: Command[]
  isSearching: boolean
  mode: PaletteMode
  onHover: (id: string) => void
  onSelectCommand: (command: Command) => void
  onSelectOption: (option: CommandOption) => void
  paramOptions: CommandOption[]
  selectedId: string | undefined
}

export function CommandPaletteResults({
  commandGroups,
  filteredCommands,
  isSearching,
  mode,
  onHover,
  onSelectCommand,
  onSelectOption,
  paramOptions,
  selectedId
}: CommandPaletteResultsProps) {
  if (mode === 'params') {
    return (
      <OptionList
        onHover={onHover}
        onSelect={onSelectOption}
        options={paramOptions}
        selectedId={selectedId}
      />
    )
  }

  if (isSearching) {
    return (
      <div>
        {filteredCommands.map((command) => (
          <CommandItem
            key={command.id}
            command={command}
            isSelected={command.id === selectedId}
            showGroup={true}
            onMouseEnter={() => onHover(command.id)}
            onClick={() => onSelectCommand(command)}
          />
        ))}
      </div>
    )
  }

  return (
    <div>
      {Array.from(commandGroups.entries()).map(([group, commands]) => (
        <div key={group}>
          <div className="px-2 py-2 text-muted-foreground capitalize text-xs">
            {group}
          </div>
          {commands.map((command) => (
            <CommandItem
              key={command.id}
              command={command}
              isSelected={command.id === selectedId}
              onMouseEnter={() => onHover(command.id)}
              onClick={() => onSelectCommand(command)}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

function OptionList({
  onHover,
  onSelect,
  options,
  selectedId
}: {
  onHover: (id: string) => void
  onSelect: (option: CommandOption) => void
  options: CommandOption[]
  selectedId: string | undefined
}) {
  return (
    <div className="pt-2">
      {options.length === 0 ? (
        <div className="px-2 py-4 text-center text-muted-foreground text-sm">
          No results found
        </div>
      ) : (
        options.map((option) => (
          <OptionItem
            key={option.id}
            option={option}
            isSelected={option.id === selectedId}
            onMouseEnter={() => onHover(option.id)}
            onClick={() => onSelect(option)}
          />
        ))
      )}
    </div>
  )
}

type ItemRowProps = {
  isSelected?: boolean
  onClick?: () => void
  onMouseEnter?: () => void
}

function ItemRow({
  children,
  isSelected,
  onClick,
  onMouseEnter
}: ItemRowProps & { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)

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
      {children}
    </div>
  )
}

function CommandItem({
  command,
  showGroup,
  ...rowProps
}: ItemRowProps & {
  command: Command
  showGroup?: boolean
}) {
  const Icon = command.icon

  return (
    <ItemRow {...rowProps}>
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
          {command.shortcut.mod && <Kbd>{modifierKey()}</Kbd>}

          <Kbd>{command.shortcut.key}</Kbd>
        </div>
      )}
    </ItemRow>
  )
}

function OptionItem({
  option,
  ...rowProps
}: ItemRowProps & {
  option: CommandOption
}) {
  const Icon = option.icon

  return (
    <ItemRow {...rowProps}>
      {Icon && <Icon className="size-3 text-muted-foreground mr-0.5" />}

      <div className="flex-1 min-w-0">
        <div className="truncate">{option.label}</div>

        {option.description && (
          <div className="text-xs text-muted-foreground truncate">
            {option.description}
          </div>
        )}
      </div>
    </ItemRow>
  )
}
