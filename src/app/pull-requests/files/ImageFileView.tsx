import { useEffect, useState, type ReactElement } from 'react'

import type { ModifiedFile } from '@/types/pull-request-details'
import type { PullRequest } from '@/types/pull-request'

import { getBlobImageUrl } from '@/app/lib/api'

interface ImageFileViewProps {
  file: ModifiedFile
  pullRequest: PullRequest
}

type LoadState = 'error' | 'loaded' | 'loading'

export function ImageFileView({
  file,
  pullRequest
}: ImageFileViewProps): ReactElement {
  const [source, setSource] = useState<string | null>(null)
  const [loadState, setLoadState] = useState<LoadState>('loading')

  const blobSha = file.blobSha

  useEffect(() => {
    if (!blobSha) {
      return
    }

    let cancelled = false

    setLoadState('loading')

    getBlobImageUrl({
      filePath: file.filePath,
      owner: pullRequest.repositoryOwner,
      repo: pullRequest.repositoryName,
      sha: blobSha
    })
      .then((url) => {
        if (!cancelled) {
          setSource(url)
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoadState('error')
        }
      })

    return () => {
      cancelled = true
    }
  }, [
    blobSha,
    file.filePath,
    pullRequest.repositoryOwner,
    pullRequest.repositoryName
  ])

  if (!blobSha) {
    return (
      <div className="py-2 px-3 text-muted-foreground">
        No preview available.
      </div>
    )
  }

  if (loadState === 'error') {
    return (
      <div className="py-2 px-3 text-muted-foreground">
        Failed to load image preview.
      </div>
    )
  }

  const isDeleted = file.status === 'removed'

  return (
    <div className="flex flex-col items-center gap-2 py-4 px-3">
      {source && (
        <img
          alt={file.filePath}
          className="max-w-full max-h-[32rem] rounded-md border border-border bg-muted"
          onError={() => {
            setLoadState('error')
          }}
          onLoad={() => {
            setLoadState('loaded')
          }}
          src={source}
        />
      )}

      {isDeleted && loadState === 'loaded' && (
        <span className="text-muted-foreground">
          This image was deleted in this pull request.
        </span>
      )}
    </div>
  )
}
