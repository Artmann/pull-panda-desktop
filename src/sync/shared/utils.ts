import { randomUUID } from 'crypto'

export function generateId(): string {
  return randomUUID()
}

export function normalizeCommentBody(body: string): string {
  let normalized = body.replace(/\r\n/g, '\n')

  normalized = normalized.replace(/```[^`]*```/g, (codeBlock) => {
    return codeBlock.replace(/\n{3,}/g, '\n\n')
  })

  normalized = normalized.replace(/\n{3,}/g, '\n\n')

  return normalized
}

export function getLineTypeFromDiffHunk(
  diffHunk: string
): 'add' | 'remove' | 'context' | null {
  if (!diffHunk) {
    return null
  }

  const lines = diffHunk.split('\n')

  for (let index = lines.length - 1; index >= 0; index--) {
    const line = lines[index]

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
