import { describe, expect, it } from 'vitest'

import type { MergeOptions } from '@/app/lib/api'
import type { Check } from '@/types/pull-request-details'

import { getMergeVerdict } from './merge-verdict'
import { buildStatusSummary } from './status-summary'
import {
  createCheck,
  createMergeOptions
} from './tasks/__test-helpers__/factories'
import { buildTaskGroups } from './tasks/use-derived-tasks'

function verdictFor({
  checks = [],
  mergeOptions = createMergeOptions(),
  requestedReviewers = []
}: {
  checks?: Check[]
  mergeOptions?: MergeOptions | null
  requestedReviewers?: Array<{ avatarUrl: string; login: string }>
}) {
  const taskGroups = buildTaskGroups({
    checks,
    comments: [],
    commitCount: 2,
    mergeOptions,
    pullRequest: {
      baseRefName: 'main',
      requestedReviewers,
      reviewDecision: null
    },
    reviewThreads: [],
    reviews: []
  })

  return getMergeVerdict({
    mergeOptions,
    summary: buildStatusSummary({ baseName: 'main', checks, taskGroups }),
    taskGroups
  })
}

describe('getMergeVerdict', () => {
  it('is ready when GitHub allows the merge and nothing is open', () => {
    expect(verdictFor({ checks: [createCheck()] })).toEqual({
      blockerCount: 0,
      detail: 'Checks passed, no open conversations, no conflicts.',
      title: 'Ready to merge',
      tone: 'success'
    })
  })

  it('counts what needs fixing when a check fails', () => {
    expect(
      verdictFor({ checks: [createCheck({ conclusion: 'failure' })] })
    ).toEqual({
      blockerCount: 1,
      detail: '1 thing to fix before merging.',
      title: 'Needs changes',
      tone: 'danger'
    })
  })

  it('says what it is waiting on', () => {
    expect(
      verdictFor({
        checks: [createCheck({ conclusion: null, state: 'in_progress' })],
        requestedReviewers: [{ avatarUrl: '', login: 'mira' }]
      })
    ).toEqual({
      blockerCount: 0,
      detail: 'Checks are still running and a review is outstanding.',
      title: 'Waiting',
      tone: 'warning'
    })
  })

  it('is checking until GitHub reports whether it can merge', () => {
    expect(verdictFor({ mergeOptions: null }).title).toEqual('Checking')
  })
})
