/**
 * The route for a pull request, carrying the tab when there is one.
 *
 * The tab lives in the URL and nowhere else — `PullRequestPage` derives it from
 * `?tab=` and falls back to Overview when it is missing — so anything that
 * navigates between pull requests has to pass the current tab along or the
 * reader silently loses their place.
 */
export function pullRequestPath(
  pullRequestId: string,
  tab?: string | null
): string {
  const path = `/pull-requests/${pullRequestId}`

  return tab ? `${path}?tab=${tab}` : path
}
