import type { Meta, StoryObj } from '@storybook/react-vite'

import { Tabs, TabsContent, TabsList, TabsTrigger } from './tabs'

const meta = {
  title: 'shadcn/Tabs',
  component: Tabs,
  parameters: { layout: 'centered' },
  tags: ['autodocs']
} satisfies Meta<typeof Tabs>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => (
    <Tabs defaultValue="overview" className="w-[480px]">
      <TabsList>
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="files">Files</TabsTrigger>
        <TabsTrigger value="commits">Commits</TabsTrigger>
        <TabsTrigger value="checks">Checks</TabsTrigger>
      </TabsList>
      <TabsContent value="overview">
        <p className="text-muted-foreground text-sm">
          A summary of the pull request goes here.
        </p>
      </TabsContent>
      <TabsContent value="files">
        <p className="text-muted-foreground text-sm">
          Diff view across 3 changed files.
        </p>
      </TabsContent>
      <TabsContent value="commits">
        <p className="text-muted-foreground text-sm">12 commits.</p>
      </TabsContent>
      <TabsContent value="checks">
        <p className="text-muted-foreground text-sm">
          All checks passed · 14/14.
        </p>
      </TabsContent>
    </Tabs>
  )
}
