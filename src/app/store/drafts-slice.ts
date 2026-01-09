import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

export interface DraftsState {
  [draftKey: string]: string
}

const localStorageKey = 'pull-panda-drafts'

export function loadDraftsFromStorage(): DraftsState {
  try {
    const stored = localStorage.getItem(localStorageKey)

    return stored ? JSON.parse(stored) : {}
  } catch {
    return {}
  }
}

export function saveDraftsToStorage(drafts: DraftsState): void {
  try {
    localStorage.setItem(localStorageKey, JSON.stringify(drafts))
  } catch {
    // Ignore storage errors
  }
}

const initialState: DraftsState = {}

export const draftsSlice = createSlice({
  name: 'drafts',
  initialState,
  reducers: {
    setDraft(state, action: PayloadAction<{ key: string; body: string }>) {
      const { key, body } = action.payload

      if (body) {
        state[key] = body
      } else {
        delete state[key]
      }
    },

    clearDraft(state, action: PayloadAction<{ key: string }>) {
      delete state[action.payload.key]
    },

    loadDrafts(_state, action: PayloadAction<DraftsState>) {
      return action.payload
    }
  }
})

export const draftsActions = draftsSlice.actions

export default draftsSlice.reducer

// Draft key generators
export function getDraftKeyForComment(pullRequestId: string): string {
  return `draft-comment:${pullRequestId}`
}

export function getDraftKeyForReply(
  pullRequestId: string,
  parentCommentGitHubId: string
): string {
  return `draft-reply:${pullRequestId}:${parentCommentGitHubId}`
}
