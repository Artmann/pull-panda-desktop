import type { BrowserWindow } from 'electron'

import { ipcChannels } from '../lib/ipc/channels'
import { getPullRequest, getPullRequestDetails } from './bootstrap'
import type { ResourceUpdatedEvent } from '../types/ipc-events'

export async function sendPullRequestResourceEvents(
  window: BrowserWindow,
  pullRequestId: string,
  userLogin?: string
): Promise<void> {
  const pullRequest = await getPullRequest(pullRequestId)

  if (pullRequest) {
    sendEvent(window, {
      data: pullRequest,
      pullRequestId,
      type: 'pull-request'
    })
  }

  const details = await getPullRequestDetails(pullRequestId, userLogin)

  if (details) {
    sendEvent(window, {
      data: details.checks,
      pullRequestId,
      type: 'checks'
    })

    sendEvent(window, {
      data: details.comments,
      pullRequestId,
      type: 'comments'
    })

    sendEvent(window, {
      data: details.commits,
      pullRequestId,
      type: 'commits'
    })

    sendEvent(window, {
      data: details.files,
      pullRequestId,
      type: 'modified-files'
    })

    sendEvent(window, {
      data: details.reactions,
      pullRequestId,
      type: 'reactions'
    })

    sendEvent(window, {
      data: details.reviews,
      pullRequestId,
      type: 'reviews'
    })

    sendEvent(window, {
      data: details.reviewThreads,
      pullRequestId,
      type: 'review-threads'
    })

    sendEvent(window, {
      data: details.pendingReview ?? null,
      pullRequestId,
      type: 'pending-review'
    })
  }
}

function sendEvent(window: BrowserWindow, event: ResourceUpdatedEvent): void {
  window.webContents.send(ipcChannels.ResourceUpdated, event)
}
