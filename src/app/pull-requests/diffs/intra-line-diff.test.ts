import { describe, it, expect } from 'vitest'

import type { DiffHunkLine } from './hunks'
import {
  pairModifiedLines,
  computeIntraLineDiff,
  applyIntraLineDiffHighlighting
} from './intra-line-diff'

describe('pairModifiedLines', () => {
  it('should pair a single remove with a single add', () => {
    const lines: DiffHunkLine[] = [
      {
        content: 'old line',
        localLineNumber: 1,
        type: 'remove',
        oldLineNumber: 1,
        newLineNumber: null
      },
      {
        content: 'new line',
        localLineNumber: 2,
        type: 'add',
        oldLineNumber: null,
        newLineNumber: 1
      }
    ]

    const result = pairModifiedLines(lines)

    expect(result).toEqual([{ removeIndex: 0, addIndex: 1 }])
  })

  it('should pair multiple consecutive removes with adds', () => {
    const lines: DiffHunkLine[] = [
      {
        content: 'old1',
        localLineNumber: 1,
        type: 'remove',
        oldLineNumber: 1,
        newLineNumber: null
      },
      {
        content: 'old2',
        localLineNumber: 2,
        type: 'remove',
        oldLineNumber: 2,
        newLineNumber: null
      },
      {
        content: 'new1',
        localLineNumber: 3,
        type: 'add',
        oldLineNumber: null,
        newLineNumber: 1
      },
      {
        content: 'new2',
        localLineNumber: 4,
        type: 'add',
        oldLineNumber: null,
        newLineNumber: 2
      }
    ]

    const result = pairModifiedLines(lines)

    expect(result).toEqual([
      { removeIndex: 0, addIndex: 2 },
      { removeIndex: 1, addIndex: 3 }
    ])
  })

  it('should not pair removes without matching adds', () => {
    const lines: DiffHunkLine[] = [
      {
        content: 'old1',
        localLineNumber: 1,
        type: 'remove',
        oldLineNumber: 1,
        newLineNumber: null
      },
      {
        content: 'old2',
        localLineNumber: 2,
        type: 'remove',
        oldLineNumber: 2,
        newLineNumber: null
      },
      {
        content: 'context',
        localLineNumber: 3,
        type: 'context',
        oldLineNumber: 3,
        newLineNumber: 1
      }
    ]

    const result = pairModifiedLines(lines)

    expect(result).toEqual([])
  })

  it('should handle context lines between removes and adds within gap limit', () => {
    const lines: DiffHunkLine[] = [
      {
        content: 'old',
        localLineNumber: 1,
        type: 'remove',
        oldLineNumber: 1,
        newLineNumber: null
      },
      {
        content: 'context1',
        localLineNumber: 2,
        type: 'context',
        oldLineNumber: 2,
        newLineNumber: 1
      },
      {
        content: 'context2',
        localLineNumber: 3,
        type: 'context',
        oldLineNumber: 3,
        newLineNumber: 2
      },
      {
        content: 'new',
        localLineNumber: 4,
        type: 'add',
        oldLineNumber: null,
        newLineNumber: 3
      }
    ]

    const result = pairModifiedLines(lines)

    expect(result).toEqual([{ removeIndex: 0, addIndex: 3 }])
  })

  it('should not pair when context gap exceeds 3 lines', () => {
    const lines: DiffHunkLine[] = [
      {
        content: 'old',
        localLineNumber: 1,
        type: 'remove',
        oldLineNumber: 1,
        newLineNumber: null
      },
      {
        content: 'c1',
        localLineNumber: 2,
        type: 'context',
        oldLineNumber: 2,
        newLineNumber: 1
      },
      {
        content: 'c2',
        localLineNumber: 3,
        type: 'context',
        oldLineNumber: 3,
        newLineNumber: 2
      },
      {
        content: 'c3',
        localLineNumber: 4,
        type: 'context',
        oldLineNumber: 4,
        newLineNumber: 3
      },
      {
        content: 'new',
        localLineNumber: 5,
        type: 'add',
        oldLineNumber: null,
        newLineNumber: 4
      }
    ]

    const result = pairModifiedLines(lines)

    expect(result).toEqual([])
  })

  it('should handle empty lines array', () => {
    const result = pairModifiedLines([])

    expect(result).toEqual([])
  })

  it('should only pair up to the minimum of removes and adds', () => {
    const lines: DiffHunkLine[] = [
      {
        content: 'old1',
        localLineNumber: 1,
        type: 'remove',
        oldLineNumber: 1,
        newLineNumber: null
      },
      {
        content: 'old2',
        localLineNumber: 2,
        type: 'remove',
        oldLineNumber: 2,
        newLineNumber: null
      },
      {
        content: 'old3',
        localLineNumber: 3,
        type: 'remove',
        oldLineNumber: 3,
        newLineNumber: null
      },
      {
        content: 'new1',
        localLineNumber: 4,
        type: 'add',
        oldLineNumber: null,
        newLineNumber: 1
      }
    ]

    const result = pairModifiedLines(lines)

    expect(result).toEqual([{ removeIndex: 0, addIndex: 3 }])
  })
})

describe('computeIntraLineDiff', () => {
  it('should highlight added words in add mode', () => {
    const oldContent = 'hello world'
    const newContent = 'hello beautiful world'

    const result = computeIntraLineDiff(oldContent, newContent, 'add')

    expect(result).toContain('hello')
    expect(result).toContain(
      '<mark class="diff-highlight diff-highlight-add">beautiful </mark>'
    )
    expect(result).toContain('world')
  })

  it('should highlight removed words in remove mode', () => {
    const oldContent = 'hello beautiful world'
    const newContent = 'hello world'

    const result = computeIntraLineDiff(oldContent, newContent, 'remove')

    expect(result).toContain('hello')
    expect(result).toContain(
      '<mark class="diff-highlight diff-highlight-remove">beautiful </mark>'
    )
    expect(result).toContain('world')
  })

  it('should escape HTML entities', () => {
    const oldContent = '<div>old</div>'
    const newContent = '<div>new</div>'

    const result = computeIntraLineDiff(oldContent, newContent, 'add')

    expect(result).toContain('&lt;div&gt;')
    expect(result).not.toContain('<div>')
  })

  it('should handle identical content', () => {
    const content = 'same content'

    const result = computeIntraLineDiff(content, content, 'add')

    expect(result).toEqual('same content')
    expect(result).not.toContain('<mark')
  })

  it('should handle completely different content', () => {
    const oldContent = 'old'
    const newContent = 'new'

    const addResult = computeIntraLineDiff(oldContent, newContent, 'add')
    const removeResult = computeIntraLineDiff(oldContent, newContent, 'remove')

    expect(addResult).toContain('diff-highlight-add')
    expect(removeResult).toContain('diff-highlight-remove')
  })

  it('should handle empty strings', () => {
    const result = computeIntraLineDiff('', 'new content', 'add')

    expect(result).toContain('new content')
  })

  it('should escape special characters', () => {
    const oldContent = 'a & b'
    const newContent = 'a && b'

    const result = computeIntraLineDiff(oldContent, newContent, 'add')

    expect(result).toContain('&amp;')
  })
})

describe('applyIntraLineDiffHighlighting', () => {
  it('should return a map with highlighted HTML for paired lines', () => {
    const lines: DiffHunkLine[] = [
      {
        content: 'const x = 1',
        localLineNumber: 1,
        type: 'remove',
        oldLineNumber: 1,
        newLineNumber: null
      },
      {
        content: 'const x = 2',
        localLineNumber: 2,
        type: 'add',
        oldLineNumber: null,
        newLineNumber: 1
      }
    ]

    const result = applyIntraLineDiffHighlighting(lines)

    expect(result.size).toEqual(2)
    expect(result.has(0)).toBe(true)
    expect(result.has(1)).toBe(true)
    expect(result.get(0)).toContain('diff-highlight-remove')
    expect(result.get(1)).toContain('diff-highlight-add')
  })

  it('should return empty map when no pairs exist', () => {
    const lines: DiffHunkLine[] = [
      {
        content: 'context line',
        localLineNumber: 1,
        type: 'context',
        oldLineNumber: 1,
        newLineNumber: 1
      }
    ]

    const result = applyIntraLineDiffHighlighting(lines)

    expect(result.size).toEqual(0)
  })

  it('should handle multiple pairs', () => {
    const lines: DiffHunkLine[] = [
      {
        content: 'old1',
        localLineNumber: 1,
        type: 'remove',
        oldLineNumber: 1,
        newLineNumber: null
      },
      {
        content: 'old2',
        localLineNumber: 2,
        type: 'remove',
        oldLineNumber: 2,
        newLineNumber: null
      },
      {
        content: 'new1',
        localLineNumber: 3,
        type: 'add',
        oldLineNumber: null,
        newLineNumber: 1
      },
      {
        content: 'new2',
        localLineNumber: 4,
        type: 'add',
        oldLineNumber: null,
        newLineNumber: 2
      }
    ]

    const result = applyIntraLineDiffHighlighting(lines)

    expect(result.size).toEqual(4)
    expect(result.has(0)).toBe(true)
    expect(result.has(1)).toBe(true)
    expect(result.has(2)).toBe(true)
    expect(result.has(3)).toBe(true)
  })
})
