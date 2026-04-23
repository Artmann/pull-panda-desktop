import type { Meta, StoryObj } from '@storybook/react-vite'

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

export const Default: Story = {
  args: {
    type: 'single',
    collapsible: true
  },
  render: (args) => (
    <div className="w-96">
      <Accordion {...args}>
        <AccordionItem value="one">
          <AccordionTrigger>What is Pull Panda?</AccordionTrigger>
          <AccordionContent>
            A delightful desktop code review tool for the AI era.
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="two">
          <AccordionTrigger>Does it sync offline?</AccordionTrigger>
          <AccordionContent>
            Yes — PR data is cached locally via SQLite.
          </AccordionContent>
        </AccordionItem>
        <AccordionItem value="three">
          <AccordionTrigger>Is it open source?</AccordionTrigger>
          <AccordionContent>Licensed under MIT.</AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  )
}

export const Multiple: Story = {
  args: { type: 'multiple' },
  render: (args) => (
    <div className="w-96">
      <Accordion {...args}>
        <AccordionItem value="one">
          <AccordionTrigger>First section</AccordionTrigger>
          <AccordionContent>Content for the first section.</AccordionContent>
        </AccordionItem>
        <AccordionItem value="two">
          <AccordionTrigger>Second section</AccordionTrigger>
          <AccordionContent>Content for the second section.</AccordionContent>
        </AccordionItem>
      </Accordion>
    </div>
  )
}
