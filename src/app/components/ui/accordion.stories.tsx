import type { Meta, StoryObj } from '@storybook/react-vite'
import type { ComponentProps, ReactElement } from 'react'

import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger
} from './accordion'

const meta = {
  title: 'shadcn/Accordion',
  component: Accordion,
  parameters: { layout: 'centered' },
  tags: ['autodocs']
} satisfies Meta<typeof Accordion>

export default meta

type Story = StoryObj<typeof meta>

interface Section {
  content: string
  title: string
  value: string
}

function renderSections(
  sections: Section[]
): (args: ComponentProps<typeof Accordion>) => ReactElement {
  return (args) => (
    <div className="w-96">
      <Accordion {...args}>
        {sections.map((section) => (
          <AccordionItem
            key={section.value}
            value={section.value}
          >
            <AccordionTrigger>{section.title}</AccordionTrigger>
            <AccordionContent>{section.content}</AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </div>
  )
}

export const Default: Story = {
  args: {
    type: 'single',
    collapsible: true
  },
  render: renderSections([
    {
      content: 'A delightful desktop code review tool for the AI era.',
      title: 'What is Pull Panda?',
      value: 'one'
    },
    {
      content: 'Yes — PR data is cached locally via SQLite.',
      title: 'Does it sync offline?',
      value: 'two'
    },
    {
      content: 'Licensed under MIT.',
      title: 'Is it open source?',
      value: 'three'
    }
  ])
}

export const Multiple: Story = {
  args: { type: 'multiple' },
  render: renderSections([
    {
      content: 'Content for the first section.',
      title: 'First section',
      value: 'one'
    },
    {
      content: 'Content for the second section.',
      title: 'Second section',
      value: 'two'
    }
  ])
}
