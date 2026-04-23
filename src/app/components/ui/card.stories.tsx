import type { Meta, StoryObj } from '@storybook/react-vite'

import { Button } from './button'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from './card'

const meta = {
  title: 'shadcn/Card',
  component: Card,
  parameters: { layout: 'centered' },
  tags: ['autodocs']
} satisfies Meta<typeof Card>

export default meta

type Story = StoryObj<typeof meta>

export const Default: Story = {
  render: () => (
    <Card className="w-96">
      <CardHeader>
        <CardTitle>Pull request #42</CardTitle>
        <CardDescription>
          Add Storybook for the shadcn components
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-muted-foreground text-sm">
          Opened 2 hours ago by artgaard · 12 commits · 3 files changed
        </p>
      </CardContent>
      <CardFooter className="gap-2">
        <Button size="sm">Review</Button>
        <Button size="sm" variant="outline">
          Skip
        </Button>
      </CardFooter>
    </Card>
  )
}

export const Minimal: Story = {
  render: () => (
    <Card className="w-72">
      <CardContent>
        <p className="text-sm">
          A card with only content — no header or footer.
        </p>
      </CardContent>
    </Card>
  )
}
