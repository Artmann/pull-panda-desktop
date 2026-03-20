import type { Issue, Severity } from './types'

export const signature = '**🤖 SnapPR**'
export const summaryMarker =
  '<!-- robot-code-review -->\n<!-- robot-code-review-summary -->'
export const commentMarker = '<!-- robot-code-review -->'

export const severityEmoji: Record<Severity, string> = {
  critical: '🔴',
  major: '🟠',
  minor: '🟡'
}

export const severityLabel: Record<Severity, string> = {
  critical: 'Critical',
  major: 'Major',
  minor: 'Minor'
}

export function issueSlug(file: string, title: string): string {
  return `${file}-${title}`
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
}

export function issueMarker(slug: string): string {
  return `<!-- robot-issue: ${slug} -->`
}

export function buildSummaryBody(summary: string, issues: Issue[]): string {
  if (issues.length === 0) {
    return `${summaryMarker}\n\n${signature}\n\nLooks good to me! :rocket:`
  }

  let body = `${summaryMarker}\n\n${signature}\n\n## Robot Code Review\n\n${summary}\n`
  body += '\n### Issues\n\n'

  for (const issue of issues) {
    const emoji = severityEmoji[issue.severity] ?? ''
    const label = severityLabel[issue.severity] ?? issue.severity
    body += `- ${emoji} **${label}:** ${issue.title} — \`${issue.file}:${issue.line}\`\n`
  }

  return body
}

export function buildIssueCommentBody(issue: Issue): string {
  const slug = issueSlug(issue.file, issue.title)
  const emoji = severityEmoji[issue.severity] ?? ''
  const label = severityLabel[issue.severity] ?? issue.severity

  return `${commentMarker}\n${issueMarker(slug)}\n\n${signature}\n\n### ${emoji} ${label}: ${issue.title}\n\n${issue.description}`
}
