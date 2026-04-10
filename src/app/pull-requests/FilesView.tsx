import {
  ChevronDownIcon,
  ChevronRightIcon,
  FolderIcon,
  FolderOpenIcon
} from 'lucide-react'
import { memo, useMemo, useState, type ReactElement } from 'react'
import { shallowEqual } from 'react-redux'

import type { PullRequest } from '@/types/pull-request'
import type { ModifiedFile } from '@/types/pull-request-details'

import { Button } from '@/app/components/ui/button'
import { useAppSelector } from '@/app/store/hooks'

import { createFileTree, extractGroupedFilesFromTree } from './files/file-tree'
import { ModifiedFileCard } from './files/ModifiedFileCard'

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

  const groupedFiles = useMemo(() => {
    const sorted = [...files].sort((a, b) => {
      const aDot = a.filePath.startsWith('.') ? 1 : 0
      const bDot = b.filePath.startsWith('.') ? 1 : 0

      if (aDot !== bDot) {
        return aDot - bDot
      }

      return a.filePath.localeCompare(b.filePath)
    })
    const tree = createFileTree(sorted.map((file) => file.filePath))

    return extractGroupedFilesFromTree(tree)
  }, [files])

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
    <div className="py-4">
      <div className="flex flex-col gap-6">
        {groupedFiles.map((group) => {
          const isCollapsed = collapsedGroups.has(group.groupName)
          const CollapsibleFolderIcon = isCollapsed
            ? FolderIcon
            : FolderOpenIcon

          return (
            <section
              key={group.groupName}
              className="flex flex-col gap-3"
            >
              <Button
                className="w-fit"
                size="sm"
                variant="ghost"
                onClick={() => {
                  toggleGroupCollapse(group.groupName)
                }}
              >
                <div className="flex items-center gap-2 text-xs text-foreground transition-colors">
                  {isCollapsed ? (
                    <ChevronRightIcon className="size-4" />
                  ) : (
                    <ChevronDownIcon className="size-4" />
                  )}
                  <CollapsibleFolderIcon className="size-4" />

                  <span className="select-none">{group.groupName}</span>
                </div>
              </Button>

              {!isCollapsed && (
                <div className="flex flex-col gap-6">
                  {group.files.map((groupFile) => {
                    const modifiedFile = files.find(
                      (f) => f.filePath === groupFile.filePath
                    )

                    if (!modifiedFile) {
                      return null
                    }

                    return (
                      <ModifiedFileCard
                        key={groupFile.filePath}
                        file={modifiedFile}
                        pullRequest={pullRequest}
                      />
                    )
                  })}
                </div>
              )}
            </section>
          )
        })}
      </div>
    </div>
  )
})
