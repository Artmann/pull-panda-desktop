import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

import type { CodeownerEntry, Collaborator } from '@/app/lib/api'

export interface ReviewerSuggestionsState {
  collaboratorsByRepo: Record<string, Collaborator[]>
  codeownersByPullRequest: Record<string, CodeownerEntry[]>
}

const initialState: ReviewerSuggestionsState = {
  collaboratorsByRepo: {},
  codeownersByPullRequest: {}
}

const reviewerSuggestionsSlice = createSlice({
  name: 'reviewerSuggestions',
  initialState,
  reducers: {
    setCollaborators(
      state,
      action: PayloadAction<{ items: Collaborator[]; repoFullName: string }>
    ) {
      state.collaboratorsByRepo[action.payload.repoFullName] =
        action.payload.items
    },

    setCodeowners(
      state,
      action: PayloadAction<{
        items: CodeownerEntry[]
        pullRequestId: string
      }>
    ) {
      state.codeownersByPullRequest[action.payload.pullRequestId] =
        action.payload.items
    }
  }
})

export const reviewerSuggestionsActions = reviewerSuggestionsSlice.actions

export default reviewerSuggestionsSlice.reducer
