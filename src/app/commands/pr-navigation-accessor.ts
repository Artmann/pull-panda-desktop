import type { PullRequestNavigationApi } from '@/app/pull-requests/PullRequestNavigationProvider'

let instance: PullRequestNavigationApi | null = null

export function setPullRequestNavigation(
  api: PullRequestNavigationApi | null
): void {
  instance = api
}

export function getPullRequestNavigation(): PullRequestNavigationApi | null {
  return instance
}
