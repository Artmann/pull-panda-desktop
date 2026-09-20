import { describe, expect, it } from 'vitest'

import type { MergeOptions } from '@/app/lib/api'

import { getMergeButtonLabel } from './merge-button-label'

function createMergeOptions(
  overrides: Partial<MergeOptions> = {}
): MergeOptions {
  return {
    allowMergeCommit: true,
    allowRebaseMerge: true,
    allowSquashMerge: true,
    mergeable: null,
    mergeableState: 'unknown',
    requirements: [],
    ...overrides
  }
}

describe('getMergeButtonLabel', () => {
  it('falls back to "Merge" when the options have not loaded', () => {
    expect(getMergeButtonLabel(null)).toEqual('Merge')
  })

  it('reports "Checking..." while GitHub computes mergeability', () => {
    expect(getMergeButtonLabel(createMergeOptions())).toEqual('Checking...')
  })

  it('reports "Ready to merge" when the pull request is mergeable', () => {
    const options = createMergeOptions({
      mergeable: true,
      mergeableState: 'clean'
    })

    expect(getMergeButtonLabel(options)).toEqual('Ready to merge')
  })

  it('reports "Has conflicts" for a dirty pull request', () => {
    const options = createMergeOptions({
      mergeable: false,
      mergeableState: 'dirty'
    })

    expect(getMergeButtonLabel(options)).toEqual('Has conflicts')
  })

  it('reports "Merge blocked" when a branch rule blocks the merge', () => {
    const options = createMergeOptions({
      mergeable: false,
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

  it('reports "Cannot merge" for any other blocking state', () => {
    const options = createMergeOptions({
      mergeable: false,
      mergeableState: 'unknown'
    })

    expect(getMergeButtonLabel(options)).toEqual('Cannot merge')
  })
})
