const imagePattern = /!\[[^\]]*\]\([^)]*\)/g
const linkPattern = /\[([^\]]*)\]\([^)]*\)/g

/** Flattens a line of markdown to the words a reader would see. */
export function markdownToPlainText(markdown: string): string {
  return markdown
    .replace(imagePattern, '')
    .replace(linkPattern, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/[*_`#>]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * The first line of a markdown message that still has words in it once the
 * markup is gone, or null when there is none.
 */
export function firstPlainLine(markdown: string | null): string | null {
  for (const line of (markdown ?? '').split('\n')) {
    const text = markdownToPlainText(line)

    if (text) {
      return text
    }
  }

  return null
}
