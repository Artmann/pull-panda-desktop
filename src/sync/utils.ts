import { randomUUID } from 'crypto'

/**
 * Generate a unique ID for database records.
 */
export function generateId(): string {
  return randomUUID()
}

/**
 * Normalize comment body by fixing line endings and cleaning up excessive blank
 * lines.
 */
export function normalizeCommentBody(body: string): string {
  let normalized = body.replace(/\r\n/g, '\n')

  normalized = normalized.replace(/```[^`]*```/g, (codeBlock) => {
    return codeBlock.replace(/\n{3,}/g, '\n\n')
  })

  normalized = normalized.replace(/\n{3,}/g, '\n\n')

  return normalized
}

/**
 * Detect the type of line (added, removed, or context) from a diff hunk.
 * Returns 'remove' if the line starts with '-', 'add' if it starts with '+',
 * or 'context' if it starts with a space.
 */
export function getLineTypeFromDiffHunk(
  diffHunk: string
): 'add' | 'remove' | 'context' | null {
  if (!diffHunk) {
    return null
  }

  const lines = diffHunk.split('\n')

  for (let i = lines.length - 1; i >= 0; i--) {
    const line = lines[i]

    if (line.length === 0) {
      continue
    }

    const firstChar = line[0]

    if (firstChar === '-') {
      return 'remove'
    }

    if (firstChar === '+') {
      return 'add'
    }

    if (firstChar === ' ') {
      return 'context'
    }

    if (line.startsWith('@@')) {
      continue
    }

    break
  }

  return null
}
