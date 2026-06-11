interface FileTreeNode {
  children?: { [key: string]: FileTreeNode }
  name: string
  path: string
  type: 'file' | 'directory'
}

export interface FileTree {
  [key: string]: FileTreeNode
}

function getOrCreateNode(
  level: FileTree,
  name: string,
  path: string,
  isFile: boolean
): FileTreeNode {
  const existing = level[name]

  if (existing) {
    return existing
  }

  const node: FileTreeNode = isFile
    ? { name, path, type: 'file' }
    : { children: {}, name, path, type: 'directory' }
  level[name] = node

  return node
}

function insertPath(tree: FileTree, filePath: string): void {
  const normalizedPath = filePath.replace(/\\/g, '/')
  const segments = normalizedPath
    .split('/')
    .filter((segment) => segment.length > 0)

  let currentLevel = tree
  let currentPath = ''

  for (let i = 0; i < segments.length; i++) {
    const segment = segments[i]
    const isLastSegment = i === segments.length - 1
    const isFile = isLastSegment && segment.includes('.')

    currentPath += (currentPath ? '/' : '') + segment

    const node = getOrCreateNode(currentLevel, segment, currentPath, isFile)

    if (!isFile && node.children) {
      currentLevel = node.children
    }
  }
}

export function createFileTree(filePaths: string[]): FileTree {
  const tree: FileTree = {}

  for (const filePath of filePaths) {
    insertPath(tree, filePath)
  }

  return tree
}

interface GroupedFiles {
  groupName: string
  files: Array<{ filePath: string }>
}

export function extractGroupedFilesFromTree(
  tree: Record<string, FileTreeNode>
): GroupedFiles[] {
  const groups: GroupedFiles[] = []

  function traverseNode(node: FileTreeNode): void {
    if (node.type === 'directory' && node.children) {
      const filesInThisDir: Array<{ filePath: string }> = []

      Object.values(node.children).forEach((child) => {
        if (child.type === 'file') {
          filesInThisDir.push({ filePath: child.path })
        }
      })

      if (filesInThisDir.length > 0) {
        groups.push({
          groupName: node.path,
          files: filesInThisDir
        })
      }

      Object.values(node.children).forEach((child) => {
        if (child.type === 'directory') {
          traverseNode(child)
        }
      })
    }
  }

  // Collect root-level files (files not in any directory)
  const rootFiles: Array<{ filePath: string }> = []

  Object.values(tree).forEach((rootNode) => {
    if (rootNode.type === 'file') {
      rootFiles.push({ filePath: rootNode.path })
    } else {
      traverseNode(rootNode)
    }
  })

  // Add root files as a group at the end
  if (rootFiles.length > 0) {
    groups.push({
      groupName: '.',
      files: rootFiles
    })
  }

  return groups
}
