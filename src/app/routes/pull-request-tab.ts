const validTabs = ['overview', 'tasks', 'checks', 'files']

/** The tab named in the URL, or `overview` when it is missing or unknown. */
export function getActiveTab(tabFromUrl: string | null): string {
  if (tabFromUrl && validTabs.includes(tabFromUrl)) {
    return tabFromUrl
  }

  return 'overview'
}
