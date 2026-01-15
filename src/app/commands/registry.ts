import type { Command, CommandContext, CommandGroup } from './types'

class CommandRegistry {
  private commands: Map<string, Command> = new Map()

  register(command: Command): void {
    this.commands.set(command.id, command)
  }

  unregister(id: string): void {
    this.commands.delete(id)
  }

  getById(id: string): Command | undefined {
    return this.commands.get(id)
  }

  getAll(): Command[] {
    return Array.from(this.commands.values())
  }

  listAvailable(context: CommandContext): Command[] {
    return this.getAll().filter((command) => command.isAvailable(context))
  }

  listByGroup(context: CommandContext): Map<CommandGroup, Command[]> {
    const available = this.listAvailable(context)
    const grouped = new Map<CommandGroup, Command[]>()

    for (const command of available) {
      const group = grouped.get(command.group) ?? []
      group.push(command)
      grouped.set(command.group, group)
    }

    return grouped
  }
}

export const commandRegistry = new CommandRegistry()
