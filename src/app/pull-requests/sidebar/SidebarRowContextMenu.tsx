import { CopyIcon, ExternalLinkIcon, GitBranchIcon } from 'lucide-react'
import { type ReactElement, type ReactNode } from 'react'
import { toast } from 'sonner'

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger
} from '@/app/components/ui/context-menu'
import type { PullRequest } from '@/types/pull-request'

function copy(value: string, message: string): void {
  navigator.clipboard
    .writeText(value)
    .then(() => {
      toast.success(message)
    })
    .catch((error: unknown) => {
      console.error('Failed to copy to clipboard:', error)
      toast.error('Could not copy to the clipboard.')
    })
}

interface SidebarRowContextMenuProps {
  children: ReactNode
  pullRequest: PullRequest
}

export function SidebarRowContextMenu({
  children,
  pullRequest
}: SidebarRowContextMenuProps): ReactElement {
  const branch = pullRequest.headRefName

  const handleOpenInGitHub = () => {
    window.electron.openUrl(pullRequest.url).catch((error: unknown) => {
      console.error('Failed to open pull request on GitHub:', error)
      toast.error('Could not open the pull request on GitHub.')
    })
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>

      <ContextMenuContent className="w-52">
        <ContextMenuItem onSelect={handleOpenInGitHub}>
          <ExternalLinkIcon />
          Open in GitHub
        </ContextMenuItem>

        <ContextMenuSeparator />

        <ContextMenuItem onSelect={() => copy(pullRequest.url, 'Link copied.')}>
          <CopyIcon />
          Copy GitHub link
        </ContextMenuItem>

        <ContextMenuItem
          disabled={branch === null}
          onSelect={() => {
            if (branch !== null) {
              copy(branch, 'Branch name copied.')
            }
          }}
        >
          <GitBranchIcon />
          Copy branch name
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}
