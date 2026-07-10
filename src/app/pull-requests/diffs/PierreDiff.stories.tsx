import type { Meta, StoryObj } from '@storybook/react-vite'
import { Provider } from 'react-redux'

import { ThemeProvider } from '@/app/lib/store/themeContext'
import { createStore } from '@/app/store'
import type { Comment } from '@/types/pull-request-details'
import type { PullRequest } from '@/types/pull-request'

import { DiffsWorkerPoolProvider } from './diffs-provider'
import { PierreDiff } from './PierreDiff'

const store = createStore()

const pullRequest = {
  id: 'pr-1',
  number: 1,
  repositoryOwner: 'pull-panda',
  repositoryName: 'app'
} as PullRequest

const submittedComment: Comment = {
  id: 'comment-1',
  gitHubId: 'gh-comment-1',
  gitHubNumericId: 1,
  pullRequestId: 'pr-1',
  reviewId: null,
  body: 'Should this default to `1` instead of `0`?',
  bodyHtml: null,
  path: 'src/components/Counter.tsx',
  line: 4,
  originalLine: null,
  diffHunk: null,
  commitId: null,
  originalCommitId: null,
  gitHubReviewId: null,
  gitHubReviewThreadId: null,
  parentCommentGitHubId: null,
  userLogin: 'octocat',
  userAvatarUrl: null,
  url: null,
  gitHubCreatedAt: '2026-07-01T12:00:00Z',
  gitHubUpdatedAt: null,
  syncedAt: '2026-07-01T12:00:00Z'
}

const modifiedHunk = [
  '@@ -1,6 +1,7 @@',
  " import { useState } from 'react'",
  ' ',
  '-export function Counter() {',
  '-  const [count, setCount] = useState(0)',
  '+export function Counter({ start = 0 }) {',
  '+  const [count, setCount] = useState(start)',
  '+  const label = `Count: ${count}`',
  ' ',
  '   return <button onClick={() => setCount(count + 1)}>{count}</button>',
  ' }'
].join('\n')

const addedHunk = [
  '@@ -0,0 +1,4 @@',
  '+export function greet(name: string): string {',
  '+  return `Hello, ${name}!`',
  '+}',
  '+'
].join('\n')

const removedHunk = [
  '@@ -1,3 +0,0 @@',
  '-export function deprecated(): void {',
  '-  return undefined',
  '-}'
].join('\n')

const oldFileContents = [
  'export function compute(values: number[]): number {',
  '  let total = 0',
  '',
  '  for (const value of values) {',
  '    total += value',
  '  }',
  '',
  '  const average = total / values.length',
  '  const rounded = Math.round(average)',
  '  const doubled = rounded * 2',
  '',
  '  return doubled',
  '}',
  ''
].join('\n')

const newFileContents = [
  'export function compute(values: number[]): number {',
  '  let total = 0',
  '',
  '  for (const value of values) {',
  '    total += value * 2',
  '  }',
  '',
  '  const average = total / values.length',
  '  const rounded = Math.round(average)',
  '  const doubled = rounded * 2',
  '',
  '  return doubled',
  '}',
  ''
].join('\n')

const meta = {
  title: 'Components/PierreDiff',
  component: PierreDiff,
  decorators: [
    (Story) => (
      <Provider store={store}>
        <ThemeProvider>
          <DiffsWorkerPoolProvider>
            <div style={{ maxWidth: 820 }}>
              <Story />
            </div>
          </DiffsWorkerPoolProvider>
        </ThemeProvider>
      </Provider>
    )
  ],
  parameters: { layout: 'padded' }
} satisfies Meta<typeof PierreDiff>

export default meta

type Story = StoryObj<typeof meta>

export const Unified: Story = {
  args: {
    file: {
      diffHunk: modifiedHunk,
      filePath: 'src/components/Counter.tsx',
      status: 'modified'
    },
    layout: 'unified'
  }
}

export const Split: Story = {
  args: {
    file: {
      diffHunk: modifiedHunk,
      filePath: 'src/components/Counter.tsx',
      status: 'modified'
    },
    layout: 'split'
  }
}

export const AddedFile: Story = {
  args: {
    file: {
      diffHunk: addedHunk,
      filePath: 'src/lib/greet.ts',
      status: 'added'
    },
    layout: 'unified'
  }
}

export const RemovedFile: Story = {
  args: {
    file: {
      diffHunk: removedHunk,
      filePath: 'src/lib/deprecated.ts',
      status: 'removed'
    },
    layout: 'unified'
  }
}

export const RenamedFile: Story = {
  args: {
    file: {
      diffHunk: modifiedHunk,
      filePath: 'src/components/Counter.tsx',
      previousFilename: 'src/components/OldCounter.tsx',
      status: 'renamed'
    },
    layout: 'unified'
  }
}

export const WithComments: Story = {
  args: {
    file: {
      diffHunk: modifiedHunk,
      filePath: 'src/components/Counter.tsx',
      status: 'modified'
    },
    layout: 'unified',
    pullRequest,
    submittedComments: [submittedComment]
  }
}

export const Expandable: Story = {
  args: {
    file: {
      diffHunk: '@@ -5 +5 @@\n-    total += value\n+    total += value * 2',
      filePath: 'src/lib/compute.ts',
      status: 'modified'
    },
    fullFile: {
      newContents: newFileContents,
      oldContents: oldFileContents
    },
    layout: 'unified'
  }
}
