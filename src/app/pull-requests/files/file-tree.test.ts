import { describe, it, expect } from 'vitest'

import {
  createFileTree,
  extractGroupedFilesFromTree,
  type FileTree
} from './file-tree'

describe('createFileTree', () => {
  it('creates a tree from file paths', () => {
    const filePaths = ['src/index.ts', 'src/utils.ts', 'README.md']
    const tree = createFileTree(filePaths)

    expect(tree).toEqual({
      'README.md': {
        name: 'README.md',
        path: 'README.md',
        type: 'file'
      },
      src: {
        children: {
          'index.ts': {
            name: 'index.ts',
            path: 'src/index.ts',
            type: 'file'
          },
          'utils.ts': {
            name: 'utils.ts',
            path: 'src/utils.ts',
            type: 'file'
          }
        },
        name: 'src',
        path: 'src',
        type: 'directory'
      }
    })
  })

  it('handles nested directories', () => {
    const filePaths = ['src/components/Button.tsx']
    const tree = createFileTree(filePaths)

    expect(tree.src).toBeDefined()
    expect(tree.src.children?.components).toBeDefined()
    expect(tree.src.children?.components.children?.['Button.tsx']).toBeDefined()
  })
})

describe('extractGroupedFilesFromTree', () => {
  it('extracts files grouped by directory', () => {
    const tree: FileTree = {
      src: {
        name: 'src',
        path: 'src',
        type: 'directory',
        children: {
          'index.ts': {
            name: 'index.ts',
            path: 'src/index.ts',
            type: 'file'
          },
          'utils.ts': {
            name: 'utils.ts',
            path: 'src/utils.ts',
            type: 'file'
          }
        }
      }
    }

    const groups = extractGroupedFilesFromTree(tree)

    expect(groups).toEqual([
      {
        groupName: 'src',
        files: [{ filePath: 'src/index.ts' }, { filePath: 'src/utils.ts' }]
      }
    ])
  })

  it('extracts root-level files into a "." group', () => {
    const tree: FileTree = {
      'README.md': {
        name: 'README.md',
        path: 'README.md',
        type: 'file'
      },
      '.gitignore': {
        name: '.gitignore',
        path: '.gitignore',
        type: 'file'
      }
    }

    const groups = extractGroupedFilesFromTree(tree)

    expect(groups).toEqual([
      {
        groupName: '.',
        files: [{ filePath: 'README.md' }, { filePath: '.gitignore' }]
      }
    ])
  })

  it('places root-level files group at the beginning', () => {
    const tree: FileTree = {
      src: {
        name: 'src',
        path: 'src',
        type: 'directory',
        children: {
          'index.ts': {
            name: 'index.ts',
            path: 'src/index.ts',
            type: 'file'
          }
        }
      },
      'README.md': {
        name: 'README.md',
        path: 'README.md',
        type: 'file'
      }
    }

    const groups = extractGroupedFilesFromTree(tree)

    expect(groups[0]).toEqual({
      groupName: '.',
      files: [{ filePath: 'README.md' }]
    })

    expect(groups[1]).toEqual({
      groupName: 'src',
      files: [{ filePath: 'src/index.ts' }]
    })
  })

  it('handles nested directories', () => {
    const tree: FileTree = {
      src: {
        name: 'src',
        path: 'src',
        type: 'directory',
        children: {
          components: {
            name: 'components',
            path: 'src/components',
            type: 'directory',
            children: {
              'Button.tsx': {
                name: 'Button.tsx',
                path: 'src/components/Button.tsx',
                type: 'file'
              }
            }
          },
          'index.ts': {
            name: 'index.ts',
            path: 'src/index.ts',
            type: 'file'
          }
        }
      }
    }

    const groups = extractGroupedFilesFromTree(tree)

    expect(groups).toHaveLength(2)
    expect(groups).toContainEqual({
      groupName: 'src',
      files: [{ filePath: 'src/index.ts' }]
    })
    expect(groups).toContainEqual({
      groupName: 'src/components',
      files: [{ filePath: 'src/components/Button.tsx' }]
    })
  })

  it('returns empty array for empty tree', () => {
    const groups = extractGroupedFilesFromTree({})

    expect(groups).toEqual([])
  })
})
