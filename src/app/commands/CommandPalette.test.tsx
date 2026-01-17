/**
 * @vitest-environment jsdom
 */
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

import {
  CommandPalette,
  openCommandPalette,
  closeCommandPalette
} from './CommandPalette'
import { commandRegistry } from './registry'
import type { Command, CommandContext } from './types'

const mockContext: CommandContext = {
  view: 'home',
  pullRequest: undefined,
  pullRequestDetails: undefined,
  selectedFile: undefined,
  selectedComment: undefined
}

vi.mock('./context', () => ({
  useCommandContext: () => ({ context: mockContext })
}))

vi.mock('./utils', () => ({
  isMac: () => false
}))

function createMockCommand(overrides: Partial<Command> = {}): Command {
  return {
    id: 'test.command',
    label: 'Test Command',
    group: 'app',
    isAvailable: () => true,
    execute: vi.fn(),
    ...overrides
  }
}

function getPalette() {
  return screen
    .getByRole('textbox', { hidden: true })
    .closest('[class*="fixed"]')
}

describe('CommandPalette', () => {
  let originalCommands: Command[]

  beforeEach(() => {
    // Mock scrollIntoView which doesn't exist in jsdom
    Element.prototype.scrollIntoView = vi.fn()

    // Store original commands
    originalCommands = commandRegistry.getAll()

    // Clear registry
    for (const command of originalCommands) {
      commandRegistry.unregister(command.id)
    }
  })

  afterEach(() => {
    // Restore original commands
    for (const command of commandRegistry.getAll()) {
      commandRegistry.unregister(command.id)
    }

    for (const command of originalCommands) {
      commandRegistry.register(command)
    }
  })

  it('is hidden by default', () => {
    render(<CommandPalette />)

    expect(getPalette()).toHaveStyle({ display: 'none' })
  })

  it('opens when openCommandPalette is called', async () => {
    render(<CommandPalette />)

    act(() => {
      openCommandPalette()
    })

    await waitFor(() => {
      expect(getPalette()).toHaveStyle({ display: 'flex' })
    })
  })

  it('closes when closeCommandPalette is called', async () => {
    render(<CommandPalette />)

    act(() => {
      openCommandPalette()
    })

    await waitFor(() => {
      expect(getPalette()).toHaveStyle({ display: 'flex' })
    })

    act(() => {
      closeCommandPalette()
    })

    await waitFor(() => {
      expect(getPalette()).toHaveStyle({ display: 'none' })
    })
  })

  it('closes when clicking outside the palette', async () => {
    render(<CommandPalette />)

    act(() => {
      openCommandPalette()
    })

    await waitFor(() => {
      expect(getPalette()).toHaveStyle({ display: 'flex' })
    })

    // Click the backdrop (the outer fixed div)
    const palette = getPalette()
    if (palette) fireEvent.click(palette)

    await waitFor(() => {
      expect(getPalette()).toHaveStyle({ display: 'none' })
    })
  })

  it('does not close when clicking inside the palette', async () => {
    render(<CommandPalette />)

    act(() => {
      openCommandPalette()
    })

    await waitFor(() => {
      expect(getPalette()).toHaveStyle({ display: 'flex' })
    })

    // Click the input (inside the palette)
    const input = screen.getByRole('textbox')
    fireEvent.click(input)

    // Palette should still be open
    expect(getPalette()).toHaveStyle({ display: 'flex' })
  })

  it('displays available commands grouped by category', async () => {
    const appCommand = createMockCommand({
      id: 'app.test',
      label: 'App Command',
      group: 'app'
    })
    const navCommand = createMockCommand({
      id: 'nav.test',
      label: 'Navigation Command',
      group: 'navigation'
    })

    commandRegistry.register(appCommand)
    commandRegistry.register(navCommand)

    render(<CommandPalette />)

    act(() => {
      openCommandPalette()
    })

    await waitFor(() => {
      expect(screen.getByText('App Command')).toBeInTheDocument()
      expect(screen.getByText('Navigation Command')).toBeInTheDocument()
      expect(screen.getByText('app')).toBeInTheDocument()
      expect(screen.getByText('navigation')).toBeInTheDocument()
    })
  })

  it('filters commands based on search query', async () => {
    const user = userEvent.setup()

    const syncCommand = createMockCommand({
      id: 'app.sync',
      label: 'Sync pull requests',
      group: 'app'
    })
    const homeCommand = createMockCommand({
      id: 'nav.home',
      label: 'Go to home',
      group: 'navigation'
    })

    commandRegistry.register(syncCommand)
    commandRegistry.register(homeCommand)

    render(<CommandPalette />)

    act(() => {
      openCommandPalette()
    })

    await waitFor(() => {
      expect(screen.getByText('Sync pull requests')).toBeInTheDocument()
      expect(screen.getByText('Go to home')).toBeInTheDocument()
    })

    const input = screen.getByRole('textbox')
    await user.type(input, 'sync')

    // After typing more than 2 characters, filtering kicks in
    await waitFor(() => {
      expect(screen.getByText('Sync pull requests')).toBeInTheDocument()
      expect(screen.queryByText('Go to home')).not.toBeInTheDocument()
    })
  })

  it('executes command when clicking on it', async () => {
    const executeHandler = vi.fn()
    const command = createMockCommand({
      id: 'test.click',
      label: 'Clickable Command',
      execute: executeHandler
    })

    commandRegistry.register(command)

    render(<CommandPalette />)

    act(() => {
      openCommandPalette()
    })

    await waitFor(() => {
      expect(screen.getByText('Clickable Command')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Clickable Command'))

    expect(executeHandler).toHaveBeenCalledWith(mockContext)
  })

  it('closes after executing a command', async () => {
    const command = createMockCommand({
      id: 'test.close',
      label: 'Close Test Command'
    })

    commandRegistry.register(command)

    render(<CommandPalette />)

    act(() => {
      openCommandPalette()
    })

    await waitFor(() => {
      expect(screen.getByText('Close Test Command')).toBeInTheDocument()
    })

    fireEvent.click(screen.getByText('Close Test Command'))

    await waitFor(() => {
      expect(getPalette()).toHaveStyle({ display: 'none' })
    })
  })

  it('only shows commands where isAvailable returns true', async () => {
    const availableCommand = createMockCommand({
      id: 'test.available',
      label: 'Available Command',
      isAvailable: () => true
    })
    const unavailableCommand = createMockCommand({
      id: 'test.unavailable',
      label: 'Unavailable Command',
      isAvailable: () => false
    })

    commandRegistry.register(availableCommand)
    commandRegistry.register(unavailableCommand)

    render(<CommandPalette />)

    act(() => {
      openCommandPalette()
    })

    await waitFor(() => {
      expect(screen.getByText('Available Command')).toBeInTheDocument()
      expect(screen.queryByText('Unavailable Command')).not.toBeInTheDocument()
    })
  })

  it('displays keyboard shortcut when command has one', async () => {
    const command = createMockCommand({
      id: 'test.shortcut',
      label: 'Shortcut Command',
      shortcut: { key: 'k', mod: true }
    })

    commandRegistry.register(command)

    render(<CommandPalette />)

    act(() => {
      openCommandPalette()
    })

    await waitFor(() => {
      expect(screen.getByText('Shortcut Command')).toBeInTheDocument()
      expect(screen.getByText('Ctrl')).toBeInTheDocument()
      expect(screen.getByText('k')).toBeInTheDocument()
    })
  })

  it('highlights command on mouse enter', async () => {
    const command = createMockCommand({
      id: 'test.hover',
      label: 'Hover Command'
    })

    commandRegistry.register(command)

    render(<CommandPalette />)

    act(() => {
      openCommandPalette()
    })

    await waitFor(() => {
      expect(screen.getByText('Hover Command')).toBeInTheDocument()
    })

    const commandItem = screen
      .getByText('Hover Command')
      .closest('div[class*="cursor-pointer"]')
    if (commandItem) fireEvent.mouseEnter(commandItem)

    expect(commandItem).toHaveClass('bg-muted')
  })

  it('focuses input when palette opens', async () => {
    render(<CommandPalette />)

    act(() => {
      openCommandPalette()
    })

    await waitFor(() => {
      const input = screen.getByRole('textbox')
      expect(input).toHaveFocus()
    })
  })

  it('clears query when command is executed', async () => {
    const user = userEvent.setup()

    const command = createMockCommand({
      id: 'test.clear',
      label: 'Clear Test'
    })

    commandRegistry.register(command)

    render(<CommandPalette />)

    act(() => {
      openCommandPalette()
    })

    await waitFor(() => {
      expect(getPalette()).toHaveStyle({ display: 'flex' })
    })

    const input = screen.getByRole('textbox')
    await user.type(input, 'tes')

    expect(input).toHaveValue('tes')

    fireEvent.click(screen.getByText('Clear Test'))

    // Reopen
    act(() => {
      openCommandPalette()
    })

    await waitFor(() => {
      expect(screen.getByRole('textbox')).toHaveValue('')
    })
  })

  describe('parameterized commands', () => {
    it('transitions to params mode when selecting a parameterized command', async () => {
      const command = createMockCommand({
        id: 'test.param',
        label: 'Open Item',
        param: {
          type: 'select',
          placeholder: 'Select an item...',
          getOptions: () => [
            { id: '1', label: 'Item One', value: 1 },
            { id: '2', label: 'Item Two', value: 2 }
          ]
        }
      })

      commandRegistry.register(command)

      render(<CommandPalette />)

      act(() => {
        openCommandPalette()
      })

      await waitFor(() => {
        expect(screen.getByText('Open Item')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Open Item'))

      await waitFor(() => {
        // Should show the command label as header
        expect(screen.getByText('Open Item')).toBeInTheDocument()
        // Should show options
        expect(screen.getByText('Item One')).toBeInTheDocument()
        expect(screen.getByText('Item Two')).toBeInTheDocument()
        // Should show custom placeholder
        expect(
          screen.getByPlaceholderText('Select an item...')
        ).toBeInTheDocument()
      })
    })

    it('filters options based on search query', async () => {
      const user = userEvent.setup()

      const command = createMockCommand({
        id: 'test.filter',
        label: 'Search Items',
        param: {
          type: 'select',
          getOptions: (_context, query) => {
            const items = [
              { id: '1', label: 'Apple', value: 'apple' },
              { id: '2', label: 'Banana', value: 'banana' },
              { id: '3', label: 'Cherry', value: 'cherry' }
            ]

            return items.filter((item) =>
              item.label.toLowerCase().includes(query.toLowerCase())
            )
          }
        }
      })

      commandRegistry.register(command)

      render(<CommandPalette />)

      act(() => {
        openCommandPalette()
      })

      await waitFor(() => {
        expect(screen.getByText('Search Items')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Search Items'))

      await waitFor(() => {
        expect(screen.getByText('Apple')).toBeInTheDocument()
        expect(screen.getByText('Banana')).toBeInTheDocument()
        expect(screen.getByText('Cherry')).toBeInTheDocument()
      })

      const input = screen.getByRole('textbox')
      await user.type(input, 'ban')

      await waitFor(() => {
        expect(screen.queryByText('Apple')).not.toBeInTheDocument()
        expect(screen.getByText('Banana')).toBeInTheDocument()
        expect(screen.queryByText('Cherry')).not.toBeInTheDocument()
      })
    })

    it('executes command with selected value when clicking an option', async () => {
      const executeHandler = vi.fn()

      const command = createMockCommand({
        id: 'test.select',
        label: 'Select Item',
        execute: executeHandler,
        param: {
          type: 'select',
          getOptions: () => [
            { id: '1', label: 'First', value: 'first-value' },
            { id: '2', label: 'Second', value: 'second-value' }
          ]
        }
      })

      commandRegistry.register(command)

      render(<CommandPalette />)

      act(() => {
        openCommandPalette()
      })

      await waitFor(() => {
        expect(screen.getByText('Select Item')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Select Item'))

      await waitFor(() => {
        expect(screen.getByText('Second')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Second'))

      expect(executeHandler).toHaveBeenCalledWith(mockContext, 'second-value')
    })

    it('goes back to commands mode when clicking back button', async () => {
      const command = createMockCommand({
        id: 'test.back',
        label: 'Test Back',
        param: {
          type: 'select',
          getOptions: () => [{ id: '1', label: 'Option', value: 1 }]
        }
      })

      commandRegistry.register(command)

      render(<CommandPalette />)

      act(() => {
        openCommandPalette()
      })

      await waitFor(() => {
        expect(screen.getByText('Test Back')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Test Back'))

      await waitFor(() => {
        expect(screen.getByText('Option')).toBeInTheDocument()
      })

      // Find and click the back button
      const backButton = screen.getByRole('button')
      fireEvent.click(backButton)

      await waitFor(() => {
        // Should be back in commands mode
        expect(
          screen.getByPlaceholderText('Type a command or search...')
        ).toBeInTheDocument()
        expect(screen.queryByText('Option')).not.toBeInTheDocument()
      })
    })

    it('shows description for options when provided', async () => {
      const command = createMockCommand({
        id: 'test.desc',
        label: 'With Description',
        param: {
          type: 'select',
          getOptions: () => [
            {
              id: '1',
              label: 'Main Label',
              description: 'This is the description',
              value: 1
            }
          ]
        }
      })

      commandRegistry.register(command)

      render(<CommandPalette />)

      act(() => {
        openCommandPalette()
      })

      await waitFor(() => {
        expect(screen.getByText('With Description')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('With Description'))

      await waitFor(() => {
        expect(screen.getByText('Main Label')).toBeInTheDocument()
        expect(screen.getByText('This is the description')).toBeInTheDocument()
      })
    })

    it('shows "No results found" when options are empty', async () => {
      const command = createMockCommand({
        id: 'test.empty',
        label: 'Empty Options',
        param: {
          type: 'select',
          getOptions: () => []
        }
      })

      commandRegistry.register(command)

      render(<CommandPalette />)

      act(() => {
        openCommandPalette()
      })

      await waitFor(() => {
        expect(screen.getByText('Empty Options')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Empty Options'))

      await waitFor(() => {
        expect(screen.getByText('No results found')).toBeInTheDocument()
      })
    })

    it('closes palette after selecting an option', async () => {
      const command = createMockCommand({
        id: 'test.close-select',
        label: 'Select and Close',
        param: {
          type: 'select',
          getOptions: () => [{ id: '1', label: 'Click Me', value: 1 }]
        }
      })

      commandRegistry.register(command)

      render(<CommandPalette />)

      act(() => {
        openCommandPalette()
      })

      await waitFor(() => {
        expect(screen.getByText('Select and Close')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Select and Close'))

      await waitFor(() => {
        expect(screen.getByText('Click Me')).toBeInTheDocument()
      })

      fireEvent.click(screen.getByText('Click Me'))

      await waitFor(() => {
        expect(getPalette()).toHaveStyle({ display: 'none' })
      })
    })
  })
})
