import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

export interface PullRequestItemsState<Item> {
  items: Item[]
}

// Builds a slice that holds a flat list of items belonging to pull requests
// (checks, commits, reviews, ...). `setForPullRequest` replaces the items of a
// single pull request while leaving the others untouched.
export function createPullRequestItemsSlice<
  Item extends { pullRequestId: string },
  Name extends string
>(name: Name) {
  const initialState: PullRequestItemsState<Item> = { items: [] }

  return createSlice({
    name,
    initialState,
    reducers: {
      setAll(
        _state,
        action: PayloadAction<Item[]>
      ): PullRequestItemsState<Item> {
        return { items: action.payload }
      },

      setForPullRequest(
        state,
        action: PayloadAction<{ items: Item[]; pullRequestId: string }>
      ): PullRequestItemsState<Item> {
        const { items, pullRequestId } = action.payload
        const currentItems = state.items as Item[]

        return {
          items: [
            ...currentItems.filter(
              (item) => item.pullRequestId !== pullRequestId
            ),
            ...items
          ]
        }
      }
    }
  })
}
