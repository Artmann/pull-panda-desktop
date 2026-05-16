import { describe, it, expect } from 'vitest'

import {
  generateId,
  normalizeCommentBody,
  getLineTypeFromDiffHunk
} from './utils'

describe('generateId', () => {
  it('should generate a valid UUID', () => {
    const id = generateId()

    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    )
  })

  it('should generate unique IDs', () => {
    const ids = new Set<string>()

    for (let i = 0; i < 100; i++) {
      ids.add(generateId())
    }

    expect(ids.size).toEqual(100)
  })
})

describe('normalizeCommentBody', () => {
  it('should convert Windows line endings to Unix', () => {
    const input = 'line1\r\nline2\r\nline3'
    const result = normalizeCommentBody(input)

    expect(result).toEqual('line1\nline2\nline3')
  })

  it('should reduce excessive blank lines to max 2', () => {
    const input = 'line1\n\n\n\n\nline2'
    const result = normalizeCommentBody(input)

    expect(result).toEqual('line1\n\nline2')
  })

  it('should preserve up to 2 consecutive newlines', () => {
    const input = 'line1\n\nline2'
    const result = normalizeCommentBody(input)

    expect(result).toEqual('line1\n\nline2')
  })

  it('should handle code blocks with excessive newlines', () => {
    const input = '```\ncode\n\n\n\nmore code\n```'
    const result = normalizeCommentBody(input)

    expect(result).toEqual('```\ncode\n\nmore code\n```')
  })

  it('should handle empty string', () => {
    const result = normalizeCommentBody('')

    expect(result).toEqual('')
  })

  it('should handle mixed line endings', () => {
    const input = 'line1\r\nline2\nline3\r\nline4'
    const result = normalizeCommentBody(input)

    expect(result).toEqual('line1\nline2\nline3\nline4')
  })
})

describe('getLineTypeFromDiffHunk', () => {
  it('should return "add" for lines starting with +', () => {
    const diffHunk = '@@ -1,3 +1,4 @@\n context\n+added line'
    const result = getLineTypeFromDiffHunk(diffHunk)

    expect(result).toEqual('add')
  })

  it('should return "remove" for lines starting with -', () => {
    const diffHunk = '@@ -1,3 +1,2 @@\n context\n-removed line'
    const result = getLineTypeFromDiffHunk(diffHunk)

    expect(result).toEqual('remove')
  })

  it('should return "context" for lines starting with space', () => {
    const diffHunk = '@@ -1,3 +1,3 @@\n context line'
    const result = getLineTypeFromDiffHunk(diffHunk)

    expect(result).toEqual('context')
  })

  it('should return null for empty diff hunk', () => {
    const result = getLineTypeFromDiffHunk('')

    expect(result).toBeNull()
  })

  it('should return null for undefined diff hunk', () => {
    const result = getLineTypeFromDiffHunk(undefined as unknown as string)

    expect(result).toBeNull()
  })

  it('should skip empty lines and find the last meaningful line', () => {
    const diffHunk = '@@ -1,3 +1,4 @@\n context\n+added line\n\n'
    const result = getLineTypeFromDiffHunk(diffHunk)

    expect(result).toEqual('add')
  })

  it('should skip @@ header lines', () => {
    const diffHunk = '@@ -1,3 +1,4 @@'
    const result = getLineTypeFromDiffHunk(diffHunk)

    expect(result).toBeNull()
  })

  it('should handle complex diff hunks', () => {
    const diffHunk = `@@ -10,6 +10,8 @@ function example() {
   const a = 1
   const b = 2
+  const c = 3
+  const d = 4`
    const result = getLineTypeFromDiffHunk(diffHunk)

    expect(result).toEqual('add')
  })

  it('should detect removed line in complex diff', () => {
    const diffHunk = `@@ -10,6 +10,4 @@ function example() {
   const a = 1
-  const b = 2
-  const c = 3`
    const result = getLineTypeFromDiffHunk(diffHunk)

    expect(result).toEqual('remove')
  })
})
