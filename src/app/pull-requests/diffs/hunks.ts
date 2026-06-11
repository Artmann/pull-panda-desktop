interface ClassifiedLine {
  content: string
  type: 'add' | 'remove' | 'context'
}

export interface DiffHunkLine {
  content: string
  newLineNumber: number | null
  oldLineNumber: number | null
  localLineNumber: number
  type: 'add' | 'remove' | 'context' | 'truncated'
}

interface LinePosition {
  line: number
  side: 'LEFT' | 'RIGHT'
}

interface ParsedDiffHunk {
  lines: DiffHunkLine[]
  newLineCount: number
  newStartLine: number
  oldLineCount: number
  oldStartLine: number
}

interface ParsedHunkHeader {
  headerContext: string
  newLineCount: number
  newStartLine: number
  oldLineCount: number
  oldStartLine: number
}

/**
 * Get the line number and side for a GitHub review comment.
 * - For removed lines: use old line number, LEFT side
 * - For added/context lines: use new line number, RIGHT side
 */
export function getLinePosition(diffLine: DiffHunkLine): LinePosition | null {
  if (diffLine.type === 'truncated') {
    return null
  }

  if (diffLine.type === 'remove') {
    if (diffLine.oldLineNumber === null) {
      return null
    }

    return {
      line: diffLine.oldLineNumber,
      side: 'LEFT'
    }
  }

  if (diffLine.newLineNumber === null) {
    return null
  }

  return {
    line: diffLine.newLineNumber,
    side: 'RIGHT'
  }
}

export function parseDiffHunk(diffHunk: string): ParsedDiffHunk {
  const hunkHeaderRegex = /@@\s-(\d+),(\d+)\s\+(\d+),(\d+)\s@@/g
  const hunkHeaders = [...diffHunk.matchAll(hunkHeaderRegex)]

  if (hunkHeaders.length > 1) {
    return parseMultiHunkDiff(diffHunk, hunkHeaders)
  }

  return parseSingleHunk(diffHunk, 1, null, null)
}

export function parseSingleHunk(
  diffHunk: string,
  startingLocalLineNumber: number,
  previousOldEnd: number | null,
  previousNewEnd: number | null
): ParsedDiffHunk {
  const allLines = diffHunk.split('\n')
  const header = parseHunkHeader(allLines[0])

  const isFirstHunk = previousOldEnd === null && previousNewEnd === null
  const shouldAddTruncatedLine = isFirstHunk && header.oldStartLine > 1
  const shouldAddHeaderContext =
    isFirstHunk && !shouldAddTruncatedLine && header.headerContext.trim() !== ''

  let rawLines = allLines.slice(1).filter((line) => line !== '')
  let oldLineNumber = header.oldStartLine
  let newLineNumber = header.newStartLine

  if (shouldAddHeaderContext) {
    rawLines = [' ' + header.headerContext, ...rawLines]
    oldLineNumber = header.oldStartLine - 1
    newLineNumber = header.newStartLine - 1
  }

  const lines: DiffHunkLine[] = []
  let localLineNumber = startingLocalLineNumber

  if (shouldAddTruncatedLine) {
    const truncatedLineNumber = header.oldStartLine - 1

    lines.push({
      content: `${truncatedLineNumber} unmodified lines`,
      localLineNumber: localLineNumber++,
      newLineNumber: truncatedLineNumber,
      oldLineNumber: truncatedLineNumber,
      type: 'truncated'
    })
  }

  const gapLine = createGapTruncatedLine({
    localLineNumber,
    newStartLine: header.newStartLine,
    oldStartLine: header.oldStartLine,
    previousNewEnd,
    previousOldEnd
  })

  if (gapLine !== null) {
    lines.push(gapLine)
    localLineNumber++
  }

  rawLines.forEach((line) => {
    const { content, type } = classifyLine(line)

    lines.push({
      content,
      localLineNumber: localLineNumber++,
      newLineNumber: type === 'remove' ? null : newLineNumber,
      oldLineNumber: type === 'add' ? null : oldLineNumber,
      type
    })

    if (type !== 'add') {
      oldLineNumber++
    }
    if (type !== 'remove') {
      newLineNumber++
    }
  })

  return {
    lines,
    newLineCount: header.newLineCount,
    newStartLine: header.newStartLine,
    oldLineCount: header.oldLineCount,
    oldStartLine: header.oldStartLine
  }
}

function classifyLine(line: string): ClassifiedLine {
  const firstChar = line[0] ?? ''

  const type =
    firstChar === '+' ? 'add' : firstChar === '-' ? 'remove' : 'context'

  const hasValidPrefix =
    firstChar === '+' || firstChar === '-' || firstChar === ' '

  return {
    content: hasValidPrefix ? line.slice(1) : line,
    type
  }
}

function createGapTruncatedLine(parameters: {
  localLineNumber: number
  newStartLine: number
  oldStartLine: number
  previousNewEnd: number | null
  previousOldEnd: number | null
}): DiffHunkLine | null {
  const {
    localLineNumber,
    newStartLine,
    oldStartLine,
    previousNewEnd,
    previousOldEnd
  } = parameters

  if (previousOldEnd === null || previousNewEnd === null) {
    return null
  }

  const gapOldLines = oldStartLine - previousOldEnd - 1
  const gapNewLines = newStartLine - previousNewEnd - 1

  if (gapOldLines <= 0 && gapNewLines <= 0) {
    return null
  }

  const gapCount = Math.max(gapOldLines, gapNewLines)

  return {
    content: `${gapCount} unmodified lines`,
    localLineNumber,
    newLineNumber: previousNewEnd + gapNewLines,
    oldLineNumber: previousOldEnd + gapOldLines,
    type: 'truncated'
  }
}

function parseHunkHeader(headerLine: string): ParsedHunkHeader {
  const headerRegex = /@@\s-(\d+)(?:,(\d+))?\s\+(\d+)(?:,(\d+))?\s@@\s*(.*)/
  const headerMatch = headerLine.match(headerRegex)

  if (!headerMatch) {
    throw new Error(`Invalid diff hunk format: ${JSON.stringify(headerLine)}`)
  }

  return {
    headerContext: headerMatch[5],
    newLineCount: headerMatch[4] ? parseInt(headerMatch[4], 10) : 1,
    newStartLine: parseInt(headerMatch[3], 10),
    oldLineCount: headerMatch[2] ? parseInt(headerMatch[2], 10) : 1,
    oldStartLine: parseInt(headerMatch[1], 10)
  }
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
