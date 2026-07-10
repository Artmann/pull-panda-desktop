import type { AnnotationSide } from '@pierre/diffs/react'

// GitHub review comments are anchored to a line number and a side: `LEFT` for
// the old (deleted) version, `RIGHT` for the new (added/context) version.
// `@pierre/diffs` uses `deletions`/`additions` for the same concept. These
// helpers translate between the two so the existing GitHub comment plumbing is
// reused unchanged.
export type GitHubSide = 'LEFT' | 'RIGHT'

export function toGitHubSide(side: AnnotationSide): GitHubSide {
  return side === 'deletions' ? 'LEFT' : 'RIGHT'
}

export function toAnnotationSide(side: GitHubSide): AnnotationSide {
  return side === 'LEFT' ? 'deletions' : 'additions'
}
