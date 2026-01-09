export interface FileTreeNode {
  children?: { [key: string]: FileTreeNode }
  name: string
  path: string
  type: 'file' | 'directory'
}

export interface FileTree {
  [key: string]: FileTreeNode
}

export function createFileTree(filePaths: string[]): FileTree {
  const tree: FileTree = {}

  for (const filePath of filePaths) {
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

      if (!currentLevel[segment]) {
        currentLevel[segment] = {
          name: segment,
          path: currentPath,
          type: isFile ? 'file' : 'directory'
        }

        if (!isFile) {
          currentLevel[segment].children = {}
        }
      }

      if (!isFile) {
        const nextLevel = currentLevel[segment].children

        if (!nextLevel) {
          continue
        }

        currentLevel = nextLevel
      }
    }
  }

  return tree
}

export interface GroupedFiles {
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

  Object.values(tree).forEach((rootNode) => {
    traverseNode(rootNode)
  })

  return groups
}
