import {
  CopyIcon,
  ExternalLinkIcon,
  EyeIcon,
  EyeOffIcon,
  GitBranchIcon
} from 'lucide-react'
import { type ReactElement, type ReactNode } from 'react'
import { toast } from 'sonner'

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger
} from '@/app/components/ui/context-menu'
import { copyToClipboard as copy } from '@/app/lib/clipboard'
import { useAppDispatch } from '@/app/store/hooks'
import type { PullRequest } from '@/types/pull-request'

import { setPullRequestHidden } from '../pull-request-actions'

interface SidebarRowContextMenuProps {
  children: ReactNode
  pullRequest: PullRequest
}

export function SidebarRowContextMenu({
  children,
  pullRequest
}: SidebarRowContextMenuProps): ReactElement {
  const dispatch = useAppDispatch()

  const branch = pullRequest.headRefName
  const isHidden = pullRequest.hiddenAt !== null

  const handleToggleHidden = () => {
    setPullRequestHidden({ dispatch, hidden: !isHidden, pullRequest })
  }

  const handleOpenInGitHub = () => {
    window.electron.openUrl(pullRequest.url).catch((error: unknown) => {
      console.error('Failed to open pull request on GitHub:', error)
      toast.error('Could not open the pull request on GitHub.')
    })
  }

  return (
    <ContextMenu>
      <ContextMenuTrigger asChild>{children}</ContextMenuTrigger>

      <ContextMenuContent className="w-44">
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

        <ContextMenuSeparator />

        <ContextMenuItem onSelect={handleToggleHidden}>
          {isHidden ? <EyeIcon /> : <EyeOffIcon />}
          {isHidden ? 'Unhide' : 'Hide'}
        </ContextMenuItem>
      </ContextMenuContent>
    </ContextMenu>
  )
}
