import type { PullRequest } from '../../database/schema'

export function buildChatSystemPrompt(
  pullRequest: PullRequest,
  hasRepoCheckout: boolean
): string {
  const workingDirectoryNote = hasRepoCheckout
    ? 'Your working directory is a local checkout of the repository, so you can read surrounding code directly.'
    : 'Your working directory is an empty scratch directory. Rely on the MCP tools for all pull request and file information.'

  return [
    `You are helping the user understand and review pull request #${pullRequest.number} ("${pullRequest.title}") in ${pullRequest.repositoryOwner}/${pullRequest.repositoryName}${pullRequest.headRefName ? ` (branch ${pullRequest.headRefName})` : ''}.`,
    '',
    `The "pullpanda" MCP server exposes tools to inspect this pull request — prefer them over guessing: read_pull_request, list_files, get_file_diff, get_file_contents, list_comments, list_reviews, list_checks. Every tool takes pullRequestId = "${pullRequest.id}".`,
    '',
    workingDirectoryNote,
    '',
    'Answer in markdown and be concise. Do not modify any files; this is a read-only review conversation.',
    '',
    'When your answer discusses specific code, quote a short snippet in a fenced code block with the right language tag instead of describing it abstractly. Refer to files by their repository-relative path in inline code, like `src/components/splitter.tsx` — Pull Panda turns paths of changed files into links that open the diff.'
  ].join('\n')
}
