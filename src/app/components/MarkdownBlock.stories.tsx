import type { Meta, StoryObj } from '@storybook/react-vite'
import { useState, type ReactElement } from 'react'

import { toggleTaskListItem } from '@/app/lib/task-list'

import { MarkdownBlock } from './MarkdownBlock'

const taskList = [
  '## Test plan',
  '',
  '- [x] Open a pull request with a task list',
  '- [ ] Click a checkbox',
  '  - [ ] Confirm it saves to GitHub',
  '- [ ] Reload and check it stuck'
].join('\n')

const meta = {
  title: 'Components/MarkdownBlock',
  component: MarkdownBlock,
  parameters: { layout: 'padded' },
  tags: ['autodocs'],
  args: { content: taskList }
} satisfies Meta<typeof MarkdownBlock>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    content: [
      '# Release notes',
      '',
      'Adds **clickable** task lists. See [the docs](https://github.com).',
      '',
      '```ts',
      'const answer = 42',
      '```'
    ].join('\n')
  }
}

export const ReadOnlyTaskList: Story = {}

function InteractiveTaskList(): ReactElement {
  const [content, setContent] = useState(taskList)

  return (
    <MarkdownBlock
      content={content}
      onToggleTask={(taskIndex) =>
        setContent(
          (current) => toggleTaskListItem(current, taskIndex) ?? current
        )
      }
    />
  )
}

export const InteractiveTask: Story = {
  render: () => <InteractiveTaskList />
}
