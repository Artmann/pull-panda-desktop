import {
  ChevronDownIcon,
  ChevronRightIcon,
  FolderIcon,
  FolderOpenIcon
} from 'lucide-react'
import { memo, useCallback, useMemo, useState, type ReactElement } from 'react'
import { shallowEqual } from 'react-redux'

import type { PullRequest } from '@/types/pull-request'
import type { ModifiedFile } from '@/types/pull-request-details'

import { Button } from '@/app/components/ui/button'
import { useAppSelector } from '@/app/store/hooks'
import { useVirtualList } from '@/app/pull-requests/use-virtual-list'

import { createFileTree, extractGroupedFilesFromTree } from './files/file-tree'
import { ModifiedFileCard } from './files/ModifiedFileCard'

type FilesRow =
  | { groupName: string; isCollapsed: boolean; type: 'group' }
  | { filePath: string; type: 'file' }

export const FilesView = memo(function FilesView({
  pullRequest
}: {
  pullRequest: PullRequest
}): ReactElement {
  const files: ModifiedFile[] = useAppSelector(
    (state) =>
      state.modifiedFiles.items.filter(
        (f) => f.pullRequestId === pullRequest.id
      ),
    shallowEqual
  )

  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set())

  const sortedFiles = useMemo(() => {
    return [...files].sort((a, b) => {
      const aDot = a.filePath.startsWith('.') ? 1 : 0
      const bDot = b.filePath.startsWith('.') ? 1 : 0

      if (aDot !== bDot) {
        return aDot - bDot
      }

      return a.filePath.localeCompare(b.filePath)
    })
  }, [files])

  const filesByPath = useMemo(() => {
    return new Map(sortedFiles.map((file) => [file.filePath, file]))
  }, [sortedFiles])

  const eagerFilePaths = useMemo(() => {
    return new Set(sortedFiles.slice(0, 3).map((file) => file.filePath))
  }, [sortedFiles])

  const groupedFiles = useMemo(() => {
    const tree = createFileTree(sortedFiles.map((file) => file.filePath))

    return extractGroupedFilesFromTree(tree)
  }, [sortedFiles])

  const rows = useMemo(() => {
    const result: FilesRow[] = []

    for (const group of groupedFiles) {
      const isCollapsed = collapsedGroups.has(group.groupName)

      result.push({ groupName: group.groupName, isCollapsed, type: 'group' })

      if (isCollapsed) {
        continue
      }

      for (const groupFile of group.files) {
        result.push({ filePath: groupFile.filePath, type: 'file' })
      }
    }

    return result
  }, [collapsedGroups, groupedFiles])

  const getItemKey = useCallback(
    (index: number) => {
      const row = rows[index]

      return row.type === 'group'
        ? `group:${row.groupName}`
        : `file:${row.filePath}`
    },
    [rows]
  )

  const estimateSize = useCallback(
    (index: number) => (rows[index].type === 'group' ? 48 : 400),
    [rows]
  )

  const { listRef, scrollMargin, virtualizer } = useVirtualList({
    count: rows.length,
    estimateSize,
    getItemKey,
    overscan: 4
  })

  const toggleGroupCollapse = (groupName: string) => {
    setCollapsedGroups((previous) => {
      const newSet = new Set(previous)

      if (newSet.has(groupName)) {
        newSet.delete(groupName)
      } else {
        newSet.add(groupName)
      }

      return newSet
    })
  }

  if (files.length === 0) {
    return (
      <div className="text-center text-muted-foreground py-8">
        No files found.
      </div>
    )
  }

  return (
    <div
      className="py-4"
      ref={listRef}
    >
      <div
        className="relative w-full"
        style={{ height: virtualizer.getTotalSize() }}
      >
        {virtualizer.getVirtualItems().map((virtualItem) => {
          const row = rows[virtualItem.index]

          return (
            <div
              key={virtualItem.key}
              className="absolute left-0 top-0 w-full pb-6"
              data-index={virtualItem.index}
              ref={virtualizer.measureElement}
              style={{
                transform: `translateY(${virtualItem.start - scrollMargin}px)`
              }}
            >
              {row.type === 'group' ? (
                <GroupHeaderRow
                  groupName={row.groupName}
                  isCollapsed={row.isCollapsed}
                  onToggle={toggleGroupCollapse}
                />
              ) : (
                <FileRow
                  eager={eagerFilePaths.has(row.filePath)}
                  file={filesByPath.get(row.filePath)}
                  pullRequest={pullRequest}
                />
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
})

function GroupHeaderRow({
  groupName,
  isCollapsed,
  onToggle
}: {
  groupName: string
  isCollapsed: boolean
  onToggle: (groupName: string) => void
}): ReactElement {
  const CollapsibleFolderIcon = isCollapsed ? FolderIcon : FolderOpenIcon

  return (
    <Button
      className="w-fit"
      size="sm"
      variant="ghost"
      onClick={() => {
        onToggle(groupName)
      }}
    >
      <div className="flex items-center gap-2 text-xs text-foreground transition-colors">
        {isCollapsed ? (
          <ChevronRightIcon className="size-4" />
        ) : (
          <ChevronDownIcon className="size-4" />
        )}
        <CollapsibleFolderIcon className="size-4" />

        <span className="select-none">{groupName}</span>
      </div>
    </Button>
  )
}

function FileRow({
  eager,
  file,
  pullRequest
}: {
  eager: boolean
  file: ModifiedFile | undefined
  pullRequest: PullRequest
}): ReactElement | null {
  if (!file) {
    return null
  }

  return (
    <ModifiedFileCard
      eager={eager}
      file={file}
      pullRequest={pullRequest}
    />
  )
}
