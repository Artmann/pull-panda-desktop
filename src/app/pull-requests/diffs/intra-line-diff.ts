import { diffWords } from 'diff'

import { escapeHtml } from '@/app/lib/utils'

import type { DiffHunkLine } from './hunks'

interface LinePair {
  addIndex: number
  removeIndex: number
}

function collectRemoveRun(lines: DiffHunkLine[], start: number): number[] {
  const removeIndices: number[] = []

  let index = start
  while (index < lines.length && lines[index].type === 'remove') {
    removeIndices.push(index)
    index++
  }

  return removeIndices
}

function collectFollowingAdds(
  lines: DiffHunkLine[],
  start: number
): { addIndices: number[]; end: number } {
  const addIndices: number[] = []

  let contextGap = 0
  let index = start

  while (index < lines.length && contextGap < 3) {
    const lineType = lines[index].type

    if (lineType === 'add') {
      addIndices.push(index)
      contextGap = 0
    } else if (lineType === 'context') {
      contextGap++
    } else {
      break
    }

    index++
  }

  return { addIndices, end: index }
}

export function pairModifiedLines(lines: DiffHunkLine[]): LinePair[] {
  const pairs: LinePair[] = []
  let index = 0

  while (index < lines.length) {
    if (lines[index].type !== 'remove') {
      index++
      continue
    }

    const removeIndices = collectRemoveRun(lines, index)
    const { addIndices, end } = collectFollowingAdds(
      lines,
      index + removeIndices.length
    )
    const pairCount = Math.min(removeIndices.length, addIndices.length)

    for (let pair = 0; pair < pairCount; pair++) {
      pairs.push({
        addIndex: addIndices[pair],
        removeIndex: removeIndices[pair]
      })
    }

    index = end
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
