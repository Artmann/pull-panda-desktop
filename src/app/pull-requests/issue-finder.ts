import type { Comment } from '@/types/pullRequestDetails'

export interface FoundIssue {
  source?: 'github' | 'jira' | 'linear'
  title?: string
  url: string
}

export function findIssuesInTheDescriptionOrInTheComments(
  owner: string,
  repo: string,
  body: string | null,
  comments: Comment[]
): FoundIssue[] {
  const safeComments = Array.isArray(comments)
    ? comments.filter((c) => c && typeof c.body === 'string')
    : []

  const allText = [body ?? '', ...safeComments.map((c) => c.body ?? '')].join(
    '\n'
  )

  const links = listMarkdownLinks(allText)
  const linearLinkIssues = links
    .filter((link) => link.url.startsWith('https://linear.app/'))
    .map((link) => ({
      source: 'linear' as const,
      title: link.text,
      url: link.url.trim().toLowerCase()
    }))

  const jiraLinkIssues = links
    .filter((link) => link.url.includes('jira'))
    .map((link) => ({
      source: 'jira' as const,
      title: link.text,
      url: link.url.trim().toLowerCase()
    }))

  const githubLinkIssues = links
    .filter(
      (link) =>
        link.url.startsWith('https://github.com/') &&
        link.url.includes('/issues/')
    )
    .map((link) => ({
      source: 'github' as const,
      title: link.text,
      url: link.url.trim().toLowerCase()
    }))

  const linearUrls = listLinearUrls(allText)
  const linearUrlIssues = linearUrls
    .filter((url) => url.startsWith('https://linear.app/'))
    .map((url) => ({
      source: 'linear' as const,
      url: url.trim().toLowerCase()
    }))

  const gitHubHashTagIssues = extractGitHubIssueHashtags(owner, repo, allText)
  const gitHubIssuesFromUrls = extractGitHubIssuesFromUrls(allText)

  const allIssues = [
    ...linearLinkIssues,
    ...linearUrlIssues,
    ...jiraLinkIssues,
    ...githubLinkIssues,
    ...gitHubHashTagIssues,
    ...gitHubIssuesFromUrls
  ]

  const issueMap = new Map<string, FoundIssue>()

  for (const issue of allIssues) {
    const existing = issueMap.get(issue.url)

    if (existing) {
      issueMap.set(issue.url, {
        url: issue.url,
        title: existing.title ?? ('title' in issue ? issue.title : undefined),
        source:
          existing.source ??
          (issue.source as 'github' | 'jira' | 'linear' | undefined)
      })
    } else {
      issueMap.set(issue.url, issue as FoundIssue)
    }
  }

  return Array.from(issueMap.values())
}

interface MarkdownLink {
  text: string
  url: string
}

function listMarkdownLinks(text: string): MarkdownLink[] {
  const linkRegex = /\[([^\]]*)\]\(([^)]*)\)/g
  const links: MarkdownLink[] = []

  let match

  while ((match = linkRegex.exec(text)) !== null) {
    links.push({
      text: match[1],
      url: match[2]
    })
  }

  return links
}

function listLinearUrls(text: string): string[] {
  const linearUrlRegex =
    /https:\/\/linear\.app\/[a-zA-Z0-9-]+\/issue\/[a-zA-Z0-9-]+\/[a-zA-Z0-9-]+/g
  const urls: string[] = []

  let match

  while ((match = linearUrlRegex.exec(text)) !== null) {
    urls.push(match[0])
  }

  return urls
}

function extractGitHubIssuesFromUrls(text: string): FoundIssue[] {
  const urlRegex =
    /https:\/\/github\.com\/([a-zA-Z0-9-]+)\/([a-zA-Z0-9-]+)\/issues\/(\d+)/g
  const issues: FoundIssue[] = []

  let match

  while ((match = urlRegex.exec(text)) !== null) {
    issues.push({
      source: 'github',
      url: match[0]
    })
  }

  return issues
}

function extractGitHubIssueHashtags(
  owner: string,
  repo: string,
  text: string
): FoundIssue[] {
  // Match #123 pattern but avoid false positives:
  // - Must be preceded by whitespace, start of string, or punctuation (not letters, digits, or &/#)
  // - Must be followed by word boundary (whitespace, punctuation, or end of string)
  const issueRegex = /(?:^|[^\w&#])#(\d+)\b/g
  const issues: FoundIssue[] = []

  let match

  while ((match = issueRegex.exec(text)) !== null) {
    issues.push({
      source: 'github',
      url: `https://github.com/${owner}/${repo}/issues/${match[1]}`,
      title: `Issue #${match[1]}`
    })
  }

  return issues
}
