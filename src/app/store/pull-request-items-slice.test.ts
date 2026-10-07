import { describe, expect, it } from 'vitest'

import { createPullRequestItemsSlice } from './pull-request-items-slice'

interface Item {
  id: string
  pullRequestId: string
}

const slice = createPullRequestItemsSlice<Item, 'items'>('items')

describe('createPullRequestItemsSlice', () => {
  it('starts with no items', () => {
    expect(slice.reducer(undefined, { type: 'unknown' })).toEqual({ items: [] })
  })

  it('replaces every item with setAll', () => {
    const state = slice.reducer(
      { items: [{ id: 'old', pullRequestId: 'pr-1' }] },
      slice.actions.setAll([{ id: 'new', pullRequestId: 'pr-2' }])
    )

    expect(state).toEqual({ items: [{ id: 'new', pullRequestId: 'pr-2' }] })
  })

  it('replaces only the items of one pull request with setForPullRequest', () => {
    const state = slice.reducer(
      {
        items: [
          { id: 'a', pullRequestId: 'pr-1' },
          { id: 'b', pullRequestId: 'pr-2' }
        ]
      },
      slice.actions.setForPullRequest({
        items: [{ id: 'c', pullRequestId: 'pr-1' }],
        pullRequestId: 'pr-1'
      })
    )

    expect(state).toEqual({
      items: [
        { id: 'b', pullRequestId: 'pr-2' },
        { id: 'c', pullRequestId: 'pr-1' }
      ]
    })
  })

  it('uses the given name for its action types', () => {
    expect(slice.actions.setAll([]).type).toEqual('items/setAll')
  })
})
