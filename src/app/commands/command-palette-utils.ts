import type { Command } from './types'

export type PaletteMode = 'commands' | 'params'

type Direction = 'down' | 'up'

const defaultPlaceholder = 'Type a command or search...'

export function getAdjacentId(
  items: { id: string }[],
  selectedId: string | undefined,
  direction: Direction
): string | undefined {
  if (items.length === 0) {
    return
  }

  const currentIndex = items.findIndex((item) => item.id === selectedId)
  const lastIndex = items.length - 1

  if (direction === 'up') {
    return items[currentIndex <= 0 ? lastIndex : currentIndex - 1].id
  }

  return items[
    currentIndex === -1 || currentIndex === lastIndex ? 0 : currentIndex + 1
  ].id
}

export function getPlaceholder(
  mode: PaletteMode,
  activeCommand: Command | null
): string {
  if (mode !== 'params') {
    return defaultPlaceholder
  }

  return activeCommand?.param?.placeholder || defaultPlaceholder
}

export function groupCommands(
  commands: Command[],
  query: string
): Map<string, Command[]> {
  const normalizedQuery = query.toLowerCase()
  const matchingCommands =
    query.trim().length > 0
      ? commands.filter((command) =>
          command.label.toLowerCase().includes(normalizedQuery)
        )
      : commands
  const groups = new Map<string, Command[]>()

  for (const command of matchingCommands) {
    const group = command.group || 'other'
    const commandsInGroup = groups.get(group) ?? []

    commandsInGroup.push(command)
    groups.set(group, commandsInGroup)
  }

  return groups
}
