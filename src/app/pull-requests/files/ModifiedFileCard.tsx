import { ExternalLinkIcon } from 'lucide-react'
import { memo, type ReactElement } from 'react'

import type { ModifiedFile } from '@/types/pull-request-details'
import type { PullRequest } from '@/types/pull-request'

import { CopyToClipboardButton } from '@/app/components/CopyToClipboardButton'
import { FileCard, FileCardBody, FileCardHeader } from '../components/FileCard'
import { SimpleDiff } from '../diffs/SimpleDiff'

interface ModifiedFileCardProps {
  file: ModifiedFile
  pullRequest: PullRequest
}

export const ModifiedFileCard = memo(function ModifiedFileCard({
  file,
  pullRequest
}: ModifiedFileCardProps): ReactElement {
  const filePath = file.filePath
  const viewFileUrl = `https://github.com/${pullRequest.repositoryOwner}/${pullRequest.repositoryName}/blob/HEAD/${encodeURI(filePath)}`

  return (
    <FileCard>
      <FileCardHeader>
        <div className="flex-1 flex items-center gap-2 font-mono text-xs">
          <span className="truncate">{file.filePath}</span>

          <CopyToClipboardButton value={file.filePath} />
        </div>

        <a
          className="text-muted-foreground hover:text-foreground transition-colors"
          href={viewFileUrl}
          rel="noopener noreferrer"
          target="_blank"
          title="View file on GitHub"
        >
          <ExternalLinkIcon className="size-3" />
        </a>
      </FileCardHeader>

      <FileCardBody>
        {file.diffHunk ? (
          <SimpleDiff diffHunk={file.diffHunk} />
        ) : (
          <div className="py-2 px-3 text-muted-foreground">
            No changes to display.
          </div>
        )}
      </FileCardBody>
    </FileCard>
  )
})
