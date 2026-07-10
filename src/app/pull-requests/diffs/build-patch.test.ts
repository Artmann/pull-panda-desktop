import { describe, expect, it } from 'vitest'

import { buildPatch } from './build-patch'

const hunk = ['@@ -1,2 +1,2 @@', ' context', '-old', '+new'].join('\n')

describe('buildPatch', () => {
  it('wraps a modified file with a git header', () => {
    const patch = buildPatch({
      diffHunk: hunk,
      filePath: 'src/app.ts',
      status: 'modified'
    })

    expect(patch).toEqual(
      [
        'diff --git a/src/app.ts b/src/app.ts',
        '--- a/src/app.ts',
        '+++ b/src/app.ts',
        '@@ -1,2 +1,2 @@',
        ' context',
        '-old',
        '+new',
        ''
      ].join('\n')
    )
  })

  it('uses /dev/null as the old side for an added file', () => {
    const patch = buildPatch({
      diffHunk: '@@ -0,0 +1 @@\n+hello',
      filePath: 'new.ts',
      status: 'added'
    })

    expect(patch).toEqual(
      [
        'diff --git a/new.ts b/new.ts',
        'new file mode 100644',
        '--- /dev/null',
        '+++ b/new.ts',
        '@@ -0,0 +1 @@',
        '+hello',
        ''
      ].join('\n')
    )
  })

  it('uses /dev/null as the new side for a removed file', () => {
    const patch = buildPatch({
      diffHunk: '@@ -1 +0,0 @@\n-gone',
      filePath: 'old.ts',
      status: 'removed'
    })

    expect(patch).toEqual(
      [
        'diff --git a/old.ts b/old.ts',
        'deleted file mode 100644',
        '--- a/old.ts',
        '+++ /dev/null',
        '@@ -1 +0,0 @@',
        '-gone',
        ''
      ].join('\n')
    )
  })

  it('emits rename metadata and the old path for a renamed file', () => {
    const patch = buildPatch({
      diffHunk: hunk,
      filePath: 'src/renamed.ts',
      previousFilename: 'src/original.ts',
      status: 'renamed'
    })

    expect(patch).toEqual(
      [
        'diff --git a/src/original.ts b/src/renamed.ts',
        'rename from src/original.ts',
        'rename to src/renamed.ts',
        '--- a/src/original.ts',
        '+++ b/src/renamed.ts',
        '@@ -1,2 +1,2 @@',
        ' context',
        '-old',
        '+new',
        ''
      ].join('\n')
    )
  })
})
