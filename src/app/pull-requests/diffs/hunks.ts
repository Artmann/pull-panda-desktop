export interface ParsedDiffHunk {
  lines: DiffHunkLine[]
  newLineCount: number
  newStartLine: number
  oldLineCount: number
  oldStartLine: number
}

export interface DiffHunkLine {
  content: string
  newLineNumber: number | null
  oldLineNumber: number | null
  localLineNumber: number
  type: 'add' | 'remove' | 'context' | 'truncated'
}

export function parseDiffHunk(diffHunk: string): ParsedDiffHunk {
  const hunkHeaderRegex = /@@\s-(\d+),(\d+)\s\+(\d+),(\d+)\s@@/g
  const hunkHeaders = [...diffHunk.matchAll(hunkHeaderRegex)]

  if (hunkHeaders.length > 1) {
    return parseMultiHunkDiff(diffHunk, hunkHeaders)
  }

  return parseSingleHunk(diffHunk, 1, null, null)
}

function parseMultiHunkDiff(
  diffHunk: string,
  hunkHeaders: RegExpMatchArray[]
): ParsedDiffHunk {
  const allLines: DiffHunkLine[] = []
  let localLineNumber = 1
  let previousOldEnd: number | null = null
  let previousNewEnd: number | null = null

  const firstHunkOldStart = parseInt(hunkHeaders[0][1], 10)
  const firstHunkOldCount = parseInt(hunkHeaders[0][2], 10)
  const firstHunkNewStart = parseInt(hunkHeaders[0][3], 10)
  const firstHunkNewCount = parseInt(hunkHeaders[0][4], 10)

  const hunkStrings: string[] = []
  for (let i = 0; i < hunkHeaders.length; i++) {
    const start = hunkHeaders[i].index ?? 0
    const end =
      i < hunkHeaders.length - 1
        ? (hunkHeaders[i + 1].index ?? diffHunk.length)
        : diffHunk.length
    hunkStrings.push(diffHunk.substring(start, end))
  }

  hunkStrings.forEach((hunkString) => {
    const hunkResult = parseSingleHunk(
      hunkString,
      localLineNumber,
      previousOldEnd,
      previousNewEnd
    )

    allLines.push(...hunkResult.lines)
    localLineNumber += hunkResult.lines.length

    let lastOldLine: number | null = null
    let lastNewLine: number | null = null
    for (let i = hunkResult.lines.length - 1; i >= 0; i--) {
      const line = hunkResult.lines[i]
      if (line.type === 'truncated') continue
      if (lastOldLine === null && line.oldLineNumber !== null) {
        lastOldLine = line.oldLineNumber
      }
      if (lastNewLine === null && line.newLineNumber !== null) {
        lastNewLine = line.newLineNumber
      }
      if (lastOldLine !== null && lastNewLine !== null) break
    }
    previousOldEnd = lastOldLine
    previousNewEnd = lastNewLine
  })

  return {
    lines: allLines,
    newLineCount: firstHunkNewCount,
    newStartLine: firstHunkNewStart,
    oldLineCount: firstHunkOldCount,
    oldStartLine: firstHunkOldStart
  }
}

function parseSingleHunk(
  diffHunk: string,
  startingLocalLineNumber: number,
  previousOldEnd: number | null,
  previousNewEnd: number | null
): ParsedDiffHunk {
  const allLines = diffHunk.split('\n')
  const headerLine = allLines[0]

  const headerRegex = /@@\s-(\d+),(\d+)\s\+(\d+),(\d+)\s@@\s*(.*)/
  const headerMatch = headerLine.match(headerRegex)

  if (!headerMatch) {
    throw new Error('Invalid diff hunk format')
  }

  const oldStartLine = parseInt(headerMatch[1], 10)
  const oldLineCount = parseInt(headerMatch[2], 10)
  const newStartLine = parseInt(headerMatch[3], 10)
  const newLineCount = parseInt(headerMatch[4], 10)
  const headerContext = headerMatch[5]

  let rawLines = allLines.slice(1).filter((line) => line !== '')

  let oldLineNumber = oldStartLine
  let newLineNumber = newStartLine
  const isFirstHunk = previousOldEnd === null && previousNewEnd === null
  const shouldAddTruncatedLine = isFirstHunk && oldStartLine > 1
  const shouldAddHeaderContext =
    headerContext &&
    headerContext.trim() &&
    isFirstHunk &&
    !shouldAddTruncatedLine

  if (shouldAddHeaderContext) {
    rawLines = [' ' + headerContext, ...rawLines]
    oldLineNumber = oldStartLine - 1
    newLineNumber = newStartLine - 1
  }

  const lines: DiffHunkLine[] = []
  let localLineNumber = startingLocalLineNumber

  if (shouldAddTruncatedLine) {
    const truncatedLineNumber = oldStartLine - 1
    const truncatedCount = oldStartLine - 1
    lines.push({
      content: `${truncatedCount} unmodified lines`,
      localLineNumber: localLineNumber++,
      type: 'truncated',
      oldLineNumber: truncatedLineNumber,
      newLineNumber: truncatedLineNumber
    })
  }

  if (previousOldEnd !== null && previousNewEnd !== null) {
    const gapOldLines = oldStartLine - previousOldEnd - 1
    const gapNewLines = newStartLine - previousNewEnd - 1
    if (gapOldLines > 0 || gapNewLines > 0) {
      const gapCount = Math.max(gapOldLines, gapNewLines)
      lines.push({
        content: `${gapCount} unmodified lines`,
        localLineNumber: localLineNumber++,
        type: 'truncated',
        oldLineNumber: previousOldEnd + gapOldLines,
        newLineNumber: previousNewEnd + gapNewLines
      })
    }
  }

  rawLines.forEach((line) => {
    const firstChar = line[0] || ''

    const type =
      firstChar === '+' ? 'add' : firstChar === '-' ? 'remove' : 'context'

    const hasValidPrefix =
      firstChar === '+' || firstChar === '-' || firstChar === ' '
    const strippedLine = hasValidPrefix ? line.slice(1) : line

    const diffLine: DiffHunkLine = {
      content: strippedLine,
      localLineNumber: localLineNumber++,
      type,
      oldLineNumber: type === 'add' ? null : oldLineNumber,
      newLineNumber: type === 'remove' ? null : newLineNumber
    }

    lines.push(diffLine)

    if (type === 'context' || type === 'remove') {
      oldLineNumber++
    }
    if (type === 'context' || type === 'add') {
      newLineNumber++
    }
  })

  return {
    lines,
    newLineCount,
    newStartLine,
    oldLineCount,
    oldStartLine
  }
}
