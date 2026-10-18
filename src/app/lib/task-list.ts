import type { ListItem, Root } from 'mdast'
import remarkGfm from 'remark-gfm'
import remarkParse from 'remark-parse'
import { unified } from 'unified'
import { visit } from 'unist-util-visit'

// Matches the list marker and the `[ ]` / `[x]` that follows it at the start of
// a task list item's source.
const taskMarkerPattern = /^((?:[-*+]|\d{1,9}[.)])[ \t]+)\[([ xX])\]/

/**
 * Flips the checkbox of the task list item at `index`, counting task list
 * items in document order, and returns the new markdown. This is the same
 * order the rendered checkboxes are numbered in, so a click on the nth
 * checkbox maps back to the nth item here. Returns `null` when there is no
 * such item.
 */
export function toggleTaskListItem(
  markdown: string,
  index: number
): string | null {
  const tree = unified().use(remarkParse).use(remarkGfm).parse(markdown) as Root
  const taskItems: ListItem[] = []

  visit(tree, 'listItem', (node: ListItem) => {
    if (typeof node.checked === 'boolean') {
      taskItems.push(node)
    }
  })

  const offset = taskItems[index]?.position?.start.offset

  if (offset === undefined) {
    return null
  }

  const match = taskMarkerPattern.exec(markdown.slice(offset))

  if (!match) {
    return null
  }

  const markerOffset = offset + match[1].length + 1
  const nextMark = match[2] === ' ' ? 'x' : ' '

  return (
    markdown.slice(0, markerOffset) +
    nextMark +
    markdown.slice(markerOffset + 1)
  )
}
