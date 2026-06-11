import { describe, it, expect } from 'vitest'

import { parseDiffHunk, parseSingleHunk } from './hunks'

describe('parseDiffHunk', () => {
  it('should parse a simple diff hunk with added lines', () => {
    const diffHunk = `@@ -1,3 +1,4 @@
 line1
 line2
+added line
 line3`

    const result = parseDiffHunk(diffHunk)

    expect(result).toEqual({
      oldStartLine: 1,
      oldLineCount: 3,
      newStartLine: 1,
      newLineCount: 4,
      lines: [
        {
          content: 'line1',
          localLineNumber: 1,
          type: 'context',
          oldLineNumber: 1,
          newLineNumber: 1
        },
        {
          content: 'line2',
          localLineNumber: 2,
          type: 'context',
          oldLineNumber: 2,
          newLineNumber: 2
        },
        {
          content: 'added line',
          localLineNumber: 3,
          type: 'add',
          oldLineNumber: null,
          newLineNumber: 3
        },
        {
          content: 'line3',
          localLineNumber: 4,
          type: 'context',
          oldLineNumber: 3,
          newLineNumber: 4
        }
      ]
    })
  })

  it('should parse a diff hunk with removed lines', () => {
    const diffHunk = `@@ -1,4 +1,3 @@
 line1
-removed line
 line2
 line3`

    const result = parseDiffHunk(diffHunk)

    expect(result.lines).toEqual([
      {
        content: 'line1',
        localLineNumber: 1,
        type: 'context',
        oldLineNumber: 1,
        newLineNumber: 1
      },
      {
        content: 'removed line',
        localLineNumber: 2,
        type: 'remove',
        oldLineNumber: 2,
        newLineNumber: null
      },
      {
        content: 'line2',
        localLineNumber: 3,
        type: 'context',
        oldLineNumber: 3,
        newLineNumber: 2
      },
      {
        content: 'line3',
        localLineNumber: 4,
        type: 'context',
        oldLineNumber: 4,
        newLineNumber: 3
      }
    ])
  })

  it('should parse a diff hunk with mixed additions and removals', () => {
    const diffHunk = `@@ -1,3 +1,3 @@
 context
-old line
+new line
 more context`

    const result = parseDiffHunk(diffHunk)

    expect(result.lines).toEqual([
      {
        content: 'context',
        localLineNumber: 1,
        type: 'context',
        oldLineNumber: 1,
        newLineNumber: 1
      },
      {
        content: 'old line',
        localLineNumber: 2,
        type: 'remove',
        oldLineNumber: 2,
        newLineNumber: null
      },
      {
        content: 'new line',
        localLineNumber: 3,
        type: 'add',
        oldLineNumber: null,
        newLineNumber: 2
      },
      {
        content: 'more context',
        localLineNumber: 4,
        type: 'context',
        oldLineNumber: 3,
        newLineNumber: 3
      }
    ])
  })

  it('should add truncated line indicator when hunk starts after line 1', () => {
    const diffHunk = `@@ -10,3 +10,4 @@
 line10
 line11
+added
 line12`

    const result = parseDiffHunk(diffHunk)

    expect(result.lines[0]).toEqual({
      content: '9 unmodified lines',
      localLineNumber: 1,
      type: 'truncated',
      oldLineNumber: 9,
      newLineNumber: 9
    })
    expect(result.lines[1].content).toEqual('line10')
  })

  it('should include header context when hunk starts at line 1', () => {
    const diffHunk = `@@ -1,3 +1,4 @@ function example() {
 const a = 1
+const b = 2
 return a`

    const result = parseDiffHunk(diffHunk)

    expect(result.lines[0]).toEqual({
      content: 'function example() {',
      localLineNumber: 1,
      type: 'context',
      oldLineNumber: 0,
      newLineNumber: 0
    })
  })

  it('should parse a hunk header with omitted old line count (implies 1)', () => {
    const diffHunk = `@@ -1 +1,6 @@
+line1
+line2
+line3
+line4
+line5
 line6`

    const result = parseDiffHunk(diffHunk)

    expect(result).toEqual({
      oldStartLine: 1,
      oldLineCount: 1,
      newStartLine: 1,
      newLineCount: 6,
      lines: [
        {
          content: 'line1',
          localLineNumber: 1,
          type: 'add',
          oldLineNumber: null,
          newLineNumber: 1
        },
        {
          content: 'line2',
          localLineNumber: 2,
          type: 'add',
          oldLineNumber: null,
          newLineNumber: 2
        },
        {
          content: 'line3',
          localLineNumber: 3,
          type: 'add',
          oldLineNumber: null,
          newLineNumber: 3
        },
        {
          content: 'line4',
          localLineNumber: 4,
          type: 'add',
          oldLineNumber: null,
          newLineNumber: 4
        },
        {
          content: 'line5',
          localLineNumber: 5,
          type: 'add',
          oldLineNumber: null,
          newLineNumber: 5
        },
        {
          content: 'line6',
          localLineNumber: 6,
          type: 'context',
          oldLineNumber: 1,
          newLineNumber: 6
        }
      ]
    })
  })

  it('should parse a hunk header with omitted new line count (implies 1)', () => {
    const diffHunk = `@@ -1,6 +1 @@
-line1
-line2
-line3
-line4
-line5
 line6`

    const result = parseDiffHunk(diffHunk)

    expect(result).toEqual({
      oldStartLine: 1,
      oldLineCount: 6,
      newStartLine: 1,
      newLineCount: 1,
      lines: [
        {
          content: 'line1',
          localLineNumber: 1,
          type: 'remove',
          oldLineNumber: 1,
          newLineNumber: null
        },
        {
          content: 'line2',
          localLineNumber: 2,
          type: 'remove',
          oldLineNumber: 2,
          newLineNumber: null
        },
        {
          content: 'line3',
          localLineNumber: 3,
          type: 'remove',
          oldLineNumber: 3,
          newLineNumber: null
        },
        {
          content: 'line4',
          localLineNumber: 4,
          type: 'remove',
          oldLineNumber: 4,
          newLineNumber: null
        },
        {
          content: 'line5',
          localLineNumber: 5,
          type: 'remove',
          oldLineNumber: 5,
          newLineNumber: null
        },
        {
          content: 'line6',
          localLineNumber: 6,
          type: 'context',
          oldLineNumber: 6,
          newLineNumber: 1
        }
      ]
    })
  })

  it('should parse a hunk header with both line counts omitted (implies 1,1)', () => {
    const diffHunk = `@@ -1 +1 @@
-old
+new`

    const result = parseDiffHunk(diffHunk)

    expect(result).toEqual({
      oldStartLine: 1,
      oldLineCount: 1,
      newStartLine: 1,
      newLineCount: 1,
      lines: [
        {
          content: 'old',
          localLineNumber: 1,
          type: 'remove',
          oldLineNumber: 1,
          newLineNumber: null
        },
        {
          content: 'new',
          localLineNumber: 2,
          type: 'add',
          oldLineNumber: null,
          newLineNumber: 1
        }
      ]
    })
  })

  it('should throw error for invalid diff hunk format', () => {
    const invalidDiff = 'not a valid diff'

    expect(() => parseDiffHunk(invalidDiff)).toThrow('Invalid diff hunk format')
  })

  it('should parse multiple hunks in a single diff', () => {
    const diffHunk = `@@ -1,3 +1,4 @@
 line1
+added1
 line2
 line3
@@ -10,3 +11,4 @@
 line10
+added2
 line11
 line12`

    const result = parseDiffHunk(diffHunk)

    expect(result.oldStartLine).toEqual(1)
    expect(result.newStartLine).toEqual(1)

    const addedLines = result.lines.filter((line) => line.type === 'add')
    expect(addedLines).toHaveLength(2)
    expect(addedLines[0].content).toEqual('added1')
    expect(addedLines[1].content).toEqual('added2')

    const truncatedLines = result.lines.filter(
      (line) => line.type === 'truncated'
    )
    expect(truncatedLines.length).toBeGreaterThanOrEqual(1)
  })

  it('should handle empty lines in diff content', () => {
    const diffHunk = `@@ -1,2 +1,3 @@
 line1
+
 line2`

    const result = parseDiffHunk(diffHunk)

    expect(result.lines).toHaveLength(3)
  })

  it('should correctly track line numbers for consecutive additions', () => {
    const diffHunk = `@@ -1,2 +1,5 @@
 start
+add1
+add2
+add3
 end`

    const result = parseDiffHunk(diffHunk)

    const addedLines = result.lines.filter((line) => line.type === 'add')

    expect(addedLines).toEqual([
      {
        content: 'add1',
        localLineNumber: 2,
        type: 'add',
        oldLineNumber: null,
        newLineNumber: 2
      },
      {
        content: 'add2',
        localLineNumber: 3,
        type: 'add',
        oldLineNumber: null,
        newLineNumber: 3
      },
      {
        content: 'add3',
        localLineNumber: 4,
        type: 'add',
        oldLineNumber: null,
        newLineNumber: 4
      }
    ])
  })

  it('should correctly track line numbers for consecutive removals', () => {
    const diffHunk = `@@ -1,5 +1,2 @@
 start
-rem1
-rem2
-rem3
 end`

    const result = parseDiffHunk(diffHunk)

    const removedLines = result.lines.filter((line) => line.type === 'remove')

    expect(removedLines).toEqual([
      {
        content: 'rem1',
        localLineNumber: 2,
        type: 'remove',
        oldLineNumber: 2,
        newLineNumber: null
      },
      {
        content: 'rem2',
        localLineNumber: 3,
        type: 'remove',
        oldLineNumber: 3,
        newLineNumber: null
      },
      {
        content: 'rem3',
        localLineNumber: 4,
        type: 'remove',
        oldLineNumber: 4,
        newLineNumber: null
      }
    ])
  })
})

describe('parseSingleHunk', () => {
  it('should parse a hunk with mixed add, remove, and context lines', () => {
    const diffHunk = `@@ -1,3 +1,3 @@
 keep
-before
+after`

    const result = parseSingleHunk(diffHunk, 1, null, null)

    expect(result).toEqual({
      oldStartLine: 1,
      oldLineCount: 3,
      newStartLine: 1,
      newLineCount: 3,
      lines: [
        {
          content: 'keep',
          localLineNumber: 1,
          type: 'context',
          oldLineNumber: 1,
          newLineNumber: 1
        },
        {
          content: 'before',
          localLineNumber: 2,
          type: 'remove',
          oldLineNumber: 2,
          newLineNumber: null
        },
        {
          content: 'after',
          localLineNumber: 3,
          type: 'add',
          oldLineNumber: null,
          newLineNumber: 2
        }
      ]
    })
  })

  it('should parse a hunk with only a header and no lines', () => {
    const diffHunk = '@@ -1,0 +1,0 @@'

    const result = parseSingleHunk(diffHunk, 1, null, null)

    expect(result).toEqual({
      oldStartLine: 1,
      oldLineCount: 0,
      newStartLine: 1,
      newLineCount: 0,
      lines: []
    })
  })

  it('should respect the starting local line number', () => {
    const diffHunk = `@@ -1,1 +1,2 @@
 context
+added`

    const result = parseSingleHunk(diffHunk, 10, null, null)

    expect(result.lines.map((line) => line.localLineNumber)).toEqual([10, 11])
  })

  it('should treat a no-newline marker as a context line', () => {
    const diffHunk = `@@ -1,2 +1,2 @@
 line1
-old last line
+new last line
\\ No newline at end of file`

    const result = parseSingleHunk(diffHunk, 1, null, null)

    expect(result.lines[3]).toEqual({
      content: '\\ No newline at end of file',
      localLineNumber: 4,
      type: 'context',
      oldLineNumber: 3,
      newLineNumber: 3
    })
  })

  it('should insert a truncated line for a first hunk starting after line 1', () => {
    const diffHunk = `@@ -5,2 +5,3 @@
 line5
+added
 line6`

    const result = parseSingleHunk(diffHunk, 1, null, null)

    expect(result.lines[0]).toEqual({
      content: '4 unmodified lines',
      localLineNumber: 1,
      type: 'truncated',
      oldLineNumber: 4,
      newLineNumber: 4
    })
  })

  it('should insert a gap line between hunks based on previous hunk ends', () => {
    const diffHunk = `@@ -10,2 +12,2 @@
 line10
 line11`

    const result = parseSingleHunk(diffHunk, 5, 4, 6)

    expect(result.lines).toEqual([
      {
        content: '5 unmodified lines',
        localLineNumber: 5,
        type: 'truncated',
        oldLineNumber: 9,
        newLineNumber: 11
      },
      {
        content: 'line10',
        localLineNumber: 6,
        type: 'context',
        oldLineNumber: 10,
        newLineNumber: 12
      },
      {
        content: 'line11',
        localLineNumber: 7,
        type: 'context',
        oldLineNumber: 11,
        newLineNumber: 13
      }
    ])
  })

  it('should not insert a gap line when hunks are adjacent', () => {
    const diffHunk = `@@ -5,1 +5,1 @@
 line5`

    const result = parseSingleHunk(diffHunk, 3, 4, 4)

    expect(result.lines).toEqual([
      {
        content: 'line5',
        localLineNumber: 3,
        type: 'context',
        oldLineNumber: 5,
        newLineNumber: 5
      }
    ])
  })

  it('should not add header context for a continuation hunk', () => {
    const diffHunk = `@@ -3,1 +3,1 @@ function example() {
 line3`

    const result = parseSingleHunk(diffHunk, 1, 2, 2)

    expect(result.lines).toEqual([
      {
        content: 'line3',
        localLineNumber: 1,
        type: 'context',
        oldLineNumber: 3,
        newLineNumber: 3
      }
    ])
  })
})
