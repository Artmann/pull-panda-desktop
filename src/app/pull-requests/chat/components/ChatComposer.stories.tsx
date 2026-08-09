import { configureStore } from '@reduxjs/toolkit'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { Provider } from 'react-redux'

import draftsReducer from '@/app/store/drafts-slice'

import { ChatComposer } from './ChatComposer'

function noop(): void {
  return
}

function buildStore(draft?: string) {
  return configureStore({
    preloadedState: {
      drafts: draft ? { 'chat:story': draft } : {}
    },
    reducer: {
      drafts: draftsReducer
    }
  })
}

const meta = {
  title: 'Components/ChatComposer',
  component: ChatComposer,
  parameters: { layout: 'centered' },
  tags: ['autodocs']
} satisfies Meta<typeof ChatComposer>

export default meta

type Story = StoryObj<typeof meta>

export const Empty: Story = {
  args: {
    draftKey: 'chat:story',
    isStreaming: false,
    onSend: noop,
    onStop: noop
  },
  decorators: [
    (Story) => (
      <Provider store={buildStore()}>
        <div className="w-160">
          <Story />
        </div>
      </Provider>
    )
  ]
}

export const WithDraft: Story = {
  args: {
    draftKey: 'chat:story',
    isStreaming: false,
    onSend: noop,
    onStop: noop
  },
  decorators: [
    (Story) => (
      <Provider store={buildStore('What does this PR change?')}>
        <div className="w-160">
          <Story />
        </div>
      </Provider>
    )
  ]
}

export const Streaming: Story = {
  args: {
    draftKey: 'chat:story',
    isStreaming: true,
    onSend: noop,
    onStop: noop
  },
  decorators: [
    (Story) => (
      <Provider store={buildStore()}>
        <div className="w-160">
          <Story />
        </div>
      </Provider>
    )
  ]
}
