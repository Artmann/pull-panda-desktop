import { describe, expect, it } from 'vitest'

import type { ModifiedFile } from '@/types/pull-request-details'

import {
  implementationCandidatesForTest,
  isTestableSourcePath,
  isTestFilePath,
  pairTestFiles
} from './test-file-pairing'

function createFile(filePath: string): ModifiedFile {
  return {
    id: filePath,
    pullRequestId: 'pr-1',
    filename: filePath.split('/').pop() ?? filePath,
    filePath,
    status: 'modified',
    additions: 1,
    deletions: 0,
    changes: 1,
    diffHunk: '@@ -1 +1 @@\n-a\n+b',
    syncedAt: '2024-01-01T00:00:00Z'
  }
}

describe('isTestFilePath', () => {
  it('recognises .test and .spec files', () => {
    expect(isTestFilePath('src/customers.test.ts')).toEqual(true)
    expect(isTestFilePath('src/customers.spec.tsx')).toEqual(true)
    expect(isTestFilePath('src/customers.ts')).toEqual(false)
    expect(isTestFilePath('src/testing.ts')).toEqual(false)
  })
})

describe('isTestableSourcePath', () => {
  it('includes TS and JS source files', () => {
    expect(isTestableSourcePath('src/customers.ts')).toEqual(true)
    expect(isTestableSourcePath('src/customers.tsx')).toEqual(true)
    expect(isTestableSourcePath('src/customers.js')).toEqual(true)
  })

  it('excludes tests, declarations, stories, configs and non-source files', () => {
    expect(isTestableSourcePath('src/customers.test.ts')).toEqual(false)
    expect(isTestableSourcePath('src/types.d.ts')).toEqual(false)
    expect(isTestableSourcePath('src/button.stories.tsx')).toEqual(false)
    expect(isTestableSourcePath('vite.config.ts')).toEqual(false)
    expect(isTestableSourcePath('docs/README.md')).toEqual(false)
    expect(isTestableSourcePath('package.json')).toEqual(false)
  })
})

describe('implementationCandidatesForTest', () => {
  it('produces co-located candidates with extension variants', () => {
    const candidates = implementationCandidatesForTest('src/customers.test.ts')

    expect(candidates).toEqual([
      'src/customers.ts',
      'src/customers.tsx',
      'src/customers.js',
      'src/customers.jsx'
    ])
  })

  it('produces mirrored candidates for test directories', () => {
    const candidates = implementationCandidatesForTest(
      'src/__tests__/customers.test.ts'
    )

    expect(candidates).toEqual([
      'src/__tests__/customers.ts',
      'src/__tests__/customers.tsx',
      'src/__tests__/customers.js',
      'src/__tests__/customers.jsx',
      'src/customers.ts',
      'src/customers.tsx',
      'src/customers.js',
      'src/customers.jsx'
    ])
  })
})

describe('pairTestFiles', () => {
  it('pairs a co-located test with its implementation', () => {
    const implementation = createFile('src/customers.ts')
    const test = createFile('src/customers.test.ts')

    expect(pairTestFiles([implementation, test])).toEqual([
      { missingTest: false, primaryFile: implementation, testFile: test }
    ])
  })

  it('pairs a test across an extension change', () => {
    const implementation = createFile('src/widget.tsx')
    const test = createFile('src/widget.test.ts')

    expect(pairTestFiles([implementation, test])).toEqual([
      { missingTest: false, primaryFile: implementation, testFile: test }
    ])
  })

  it('pairs a test living in a mirrored test directory', () => {
    const implementation = createFile('src/customers.ts')
    const test = createFile('src/__tests__/customers.test.ts')

    expect(pairTestFiles([implementation, test])).toEqual([
      { missingTest: false, primaryFile: implementation, testFile: test }
    ])
  })

  it('flags testable source files that have no test', () => {
    const implementation = createFile('src/customers.ts')

    expect(pairTestFiles([implementation])).toEqual([
      { missingTest: true, primaryFile: implementation, testFile: null }
    ])
  })

  it('does not flag non-source files', () => {
    const readme = createFile('docs/README.md')

    expect(pairTestFiles([readme])).toEqual([
      { missingTest: false, primaryFile: readme, testFile: null }
    ])
  })

  it('keeps an orphan test visible when its implementation is absent', () => {
    const test = createFile('src/customers.test.ts')

    expect(pairTestFiles([test])).toEqual([
      { missingTest: false, primaryFile: test, testFile: null }
    ])
  })
})
