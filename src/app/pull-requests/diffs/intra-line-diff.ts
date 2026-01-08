import { diffWords } from 'diff'

import { escapeHtml } from '@/app/lib/utils'

import type { DiffHunkLine } from './hunks'

export interface LinePair {
  addIndex: number
  removeIndex: number
}

export function pairModifiedLines(lines: DiffHunkLine[]): LinePair[] {
  const pairs: LinePair[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    if (line.type === 'remove') {
      const removeIndices: number[] = []
      const addIndices: number[] = []

      let j = i
      while (j < lines.length && lines[j].type === 'remove') {
        removeIndices.push(j)
        j++
      }

      let contextGap = 0
      while (j < lines.length && contextGap < 3) {
        if (lines[j].type === 'add') {
          addIndices.push(j)
          contextGap = 0
          j++
        } else if (lines[j].type === 'context') {
          contextGap++
          j++
        } else {
          break
        }
      }

      const pairCount = Math.min(removeIndices.length, addIndices.length)
      for (let k = 0; k < pairCount; k++) {
        pairs.push({
          addIndex: addIndices[k],
          removeIndex: removeIndices[k]
        })
      }

      i = j
    } else {
      i++
    }
  }

  return pairs
}

export function computeIntraLineDiff(
  oldContent: string,
  newContent: string,
  type: 'add' | 'remove'
): string {
  const differences = diffWords(oldContent, newContent)
  let html = ''

  for (const part of differences) {
    const value = escapeHtml(part.value)

    if (part.added && type === 'add') {
      html += `<mark class="diff-highlight diff-highlight-add">${value}</mark>`
    } else if (part.removed && type === 'remove') {
      html += `<mark class="diff-highlight diff-highlight-remove">${value}</mark>`
    } else if (!part.added && !part.removed) {
      html += value
    }
  }

  return html
}

export function applyIntraLineDiffHighlighting(
  lines: DiffHunkLine[]
): Map<number, string> {
  const pairs = pairModifiedLines(lines)
  const highlightMap = new Map<number, string>()

  for (const pair of pairs) {
    const addedLine = lines[pair.addIndex]
    const removedLine = lines[pair.removeIndex]

    const removedHtml = computeIntraLineDiff(
      removedLine.content,
      addedLine.content,
      'remove'
    )
    highlightMap.set(pair.removeIndex, removedHtml)

    const addedHtml = computeIntraLineDiff(
      removedLine.content,
      addedLine.content,
      'add'
    )
    highlightMap.set(pair.addIndex, addedHtml)
  }

  return highlightMap
}
