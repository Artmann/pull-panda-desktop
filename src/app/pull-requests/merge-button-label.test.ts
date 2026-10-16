import { describe, expect, it } from 'vitest'

import type { MergeOptions } from '@/app/lib/api'
import type {
  AutoMergeRequest,
  MergeQueueEntry
} from '@/types/merge-requirements'

import { noMergeAutomation } from './__test-helpers__/merge-options-fixtures'
import {
  canMergeNow,
  getMergeButtonLabel,
  isReadyToMerge
} from './merge-button-label'

function createMergeOptions(
  overrides: Partial<MergeOptions> = {}
): MergeOptions {
  return {
    ...noMergeAutomation,
    allowMergeCommit: true,
    allowRebaseMerge: true,
    allowSquashMerge: true,
    mergeable: null,
    mergeableState: 'unknown',
    requirements: [],
    ...overrides
  }
}

const autoMergeRequest: AutoMergeRequest = {
  enabledAt: '2026-10-14T10:00:00Z',
  enabledByLogin: 'octocat',
  mergeMethod: 'squash'
}

const queueEntry: MergeQueueEntry = {
  enqueuedAt: '2026-10-14T10:00:00Z',
  estimatedTimeToMerge: null,
  position: 3,
  state: 'QUEUED'
}

describe('getMergeButtonLabel', () => {
  it('falls back to "Merge" when the options have not loaded', () => {
    expect(getMergeButtonLabel(null)).toEqual('Merge')
  })

  it('reports "Checking..." while GitHub computes mergeability', () => {
    expect(getMergeButtonLabel(createMergeOptions())).toEqual('Checking...')
  })

  it('offers "Merge pull request" when the pull request is mergeable', () => {
    const options = createMergeOptions({
      mergeable: true,
      mergeableState: 'clean'
    })

    expect(getMergeButtonLabel(options)).toEqual('Merge pull request')
  })

  it('reports "Has conflicts" for a dirty pull request', () => {
    const options = createMergeOptions({
      mergeable: false,
      mergeableState: 'dirty'
    })

    expect(getMergeButtonLabel(options)).toEqual('Has conflicts')
  })

  it('reports "Merge blocked" when a branch rule blocks the merge', () => {
    // GitHub reports a conflict-free branch as mergeable even when a required
    // review, such as a code owner's, is still missing.
    const options = createMergeOptions({
      mergeable: true,
      mergeableState: 'blocked'
    })

    expect(getMergeButtonLabel(options)).toEqual('Merge blocked')
  })

  it('reports "Checks failing" for an unstable pull request', () => {
    const options = createMergeOptions({
      mergeable: false,
      mergeableState: 'unstable'
    })

    expect(getMergeButtonLabel(options)).toEqual('Checks failing')
  })

  it('reports "Branch out of date" when the branch must be updated first', () => {
    const options = createMergeOptions({
      mergeable: true,
      mergeableState: 'behind'
    })

    expect(getMergeButtonLabel(options)).toEqual('Branch out of date')
  })

  it('reports "Checking..." while the merge state is still unknown', () => {
    const options = createMergeOptions({
      mergeable: true,
      mergeableState: 'unknown'
    })

    expect(getMergeButtonLabel(options)).toEqual('Checking...')
  })

  it('reports "Cannot merge" for any other blocking state', () => {
    const options = createMergeOptions({
      mergeable: true,
      mergeableState: 'draft'
    })

    expect(getMergeButtonLabel(options)).toEqual('Cannot merge')
  })
})

describe('canMergeNow', () => {
  it('allows clean, hooked and unstable pull requests', () => {
    expect(
      ['clean', 'has_hooks', 'unstable'].map((mergeableState) =>
        canMergeNow(createMergeOptions({ mergeable: true, mergeableState }))
      )
    ).toEqual([true, true, true])
  })

  it('refuses blocked, behind and draft pull requests', () => {
    expect(
      ['behind', 'blocked', 'draft'].map((mergeableState) =>
        canMergeNow(createMergeOptions({ mergeable: true, mergeableState }))
      )
    ).toEqual([false, false, false])
  })

  it('refuses before the options have loaded', () => {
    expect(canMergeNow(null)).toEqual(false)
  })
})

describe('isReadyToMerge', () => {
  it('does not treat failing checks as ready', () => {
    const options = createMergeOptions({
      mergeable: true,
      mergeableState: 'unstable'
    })

    expect(isReadyToMerge(options)).toEqual(false)
  })

  it('treats a clean pull request as ready', () => {
    const options = createMergeOptions({
      mergeable: true,
      mergeableState: 'clean'
    })

    expect(isReadyToMerge(options)).toEqual(true)
  })

  it('does not treat a queued or auto-merging pull request as ready', () => {
    const queued = createMergeOptions({
      mergeable: true,
      mergeableState: 'clean',
      mergeQueueEntry: queueEntry
    })
    const autoMerging = createMergeOptions({
      autoMergeRequest,
      mergeable: true,
      mergeableState: 'clean'
    })

    expect([isReadyToMerge(queued), isReadyToMerge(autoMerging)]).toEqual([
      false,
      false
    ])
  })
})

describe('getMergeButtonLabel with auto-merge and merge queues', () => {
  it('reports the queue position while the pull request is queued', () => {
    const options = createMergeOptions({
      isMergeQueueEnabled: true,
      mergeable: true,
      mergeableState: 'clean',
      mergeQueueEntry: queueEntry
    })

    expect(getMergeButtonLabel(options)).toEqual('In merge queue (#3)')
  })

  it('reports "In merge queue" before GitHub has placed the entry', () => {
    const options = createMergeOptions({
      mergeQueueEntry: { ...queueEntry, position: null }
    })

    expect(getMergeButtonLabel(options)).toEqual('In merge queue')
  })

  it('reports "Auto-merge enabled" over the blocking reason', () => {
    const options = createMergeOptions({
      autoMergeRequest,
      mergeable: true,
      mergeableState: 'blocked'
    })

    expect(getMergeButtonLabel(options)).toEqual('Auto-merge enabled')
  })

  it('reports "Queued when ready" for merge when ready on a queued branch', () => {
    const options = createMergeOptions({
      autoMergeRequest: { ...autoMergeRequest, mergeMethod: null },
      isMergeQueueEnabled: true,
      mergeable: true,
      mergeableState: 'blocked'
    })

    expect(getMergeButtonLabel(options)).toEqual('Queued when ready')
  })
})
