import type { Meta, StoryObj } from '@storybook/react-vite'

import type { SpanRecord } from '@/telemetry/types'

import { TraceWaterfall } from './TraceWaterfall'

const base = 1_700_000_000_000

function span(
  spanId: string,
  parentSpanId: string | null,
  name: string,
  offset: number,
  duration: number,
  status: SpanRecord['status'] = 'ok',
  source: SpanRecord['source'] = 'main'
): SpanRecord {
  return {
    id: `trace:${spanId}`,
    traceId: 'trace',
    spanId,
    parentSpanId,
    name,
    kind: 'internal',
    startTime: base + offset,
    endTime: base + offset + duration,
    durationMs: duration,
    status,
    statusMessage: status === 'error' ? 'Something failed' : null,
    attributes: {},
    events: [],
    source
  }
}

const meta = {
  title: 'Components/TraceWaterfall',
  component: TraceWaterfall
} satisfies Meta<typeof TraceWaterfall>

export default meta

type Story = StoryObj<typeof meta>

export const CrossBoundaryTrace: Story = {
  args: {
    spans: [
      span('r1', null, 'fetch POST /api/reviews', 0, 120, 'ok', 'renderer'),
      span('s1', 'r1', 'http POST /api/reviews', 10, 100),
      span('e1', 's1', 'db.reviews.insert', 20, 40),
      span('e2', 's1', 'github.rest POST /repos', 65, 30)
    ]
  }
}

export const WithError: Story = {
  args: {
    spans: [
      span('a1', null, 'sync.pullRequestDetails', 0, 300, 'error'),
      span('a2', 'a1', 'sync.checks', 10, 120, 'error'),
      span('a3', 'a1', 'sync.commits', 140, 90)
    ]
  }
}

export const Empty: Story = {
  args: {
    spans: []
  }
}
