import { createSlice, type PayloadAction } from '@reduxjs/toolkit'

export interface RecentReviewer {
  avatarUrl: string
  lastUsedAt: string
  login: string
  useCount: number
}

export interface RecentReviewersState {
  byRepo: Record<string, RecentReviewer[]>
}

const localStorageKey = 'pull-panda-recent-reviewers'
const maxPerRepo = 20

export function loadRecentReviewersFromStorage(): RecentReviewersState {
  try {
    const stored = localStorage.getItem(localStorageKey)

    if (!stored) {
      return { byRepo: {} }
    }

    const parsed = JSON.parse(stored) as RecentReviewersState

    return { byRepo: parsed.byRepo ?? {} }
  } catch {
    return { byRepo: {} }
  }
}

export function saveRecentReviewersToStorage(
  state: RecentReviewersState
): void {
  try {
    localStorage.setItem(localStorageKey, JSON.stringify(state))
  } catch {
    // Ignore storage errors.
  }
}

const initialState: RecentReviewersState = { byRepo: {} }

const recentReviewersSlice = createSlice({
  name: 'recentReviewers',
  initialState,
  reducers: {
    recordUsage(
      state,
      action: PayloadAction<{
        avatarUrl: string
        login: string
        repoFullName: string
      }>
    ) {
      const { avatarUrl, login, repoFullName } = action.payload
      const now = new Date().toISOString()
      const existing = state.byRepo[repoFullName] ?? []
      const previous = existing.find((entry) => entry.login === login)

      const updated: RecentReviewer = {
        avatarUrl,
        lastUsedAt: now,
        login,
        useCount: (previous?.useCount ?? 0) + 1
      }

      const others = existing.filter((entry) => entry.login !== login)
      const next = [updated, ...others]
        .sort((a, b) => b.lastUsedAt.localeCompare(a.lastUsedAt))
        .slice(0, maxPerRepo)

      state.byRepo[repoFullName] = next
    }
  }
})

export const recentReviewersActions = recentReviewersSlice.actions

export default recentReviewersSlice.reducer
