import { BrowserWindow } from 'electron'

import { ipcChannels } from '../lib/ipc/channels'
import { getPullRequest, getPullRequestDetails } from './bootstrap'
import type { ResourceUpdatedEvent } from '../types/ipc-events'

let cachedUserLogin: string | undefined

export function setCachedUserLogin(login: string | undefined): void {
  cachedUserLogin = login
}

export async function broadcastPullRequestResourceEvents(
  pullRequestId: string,
  userLogin?: string
): Promise<void> {
  for (const window of BrowserWindow.getAllWindows()) {
    try {
      await sendPullRequestResourceEvents(window, pullRequestId, userLogin)
    } catch (error) {
      console.warn(
        'Failed to send pull request resource events to window:',
        error
      )
    }
  }
}

export function broadcastResourceUpdated(event: ResourceUpdatedEvent): void {
  for (const window of BrowserWindow.getAllWindows()) {
    sendEvent(window, event)
  }
}

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

  const effectiveUserLogin = userLogin ?? cachedUserLogin
  const details = await getPullRequestDetails(pullRequestId, effectiveUserLogin)

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

    if (effectiveUserLogin) {
      sendEvent(window, {
        data: details.pendingReview
          ? { ...details.pendingReview, isCollapsed: false, pullRequestId }
          : null,
        pullRequestId,
        type: 'pending-review'
      })
    }
  }
}

function sendEvent(window: BrowserWindow, event: ResourceUpdatedEvent): void {
  if (window.isDestroyed() || window.webContents.isDestroyed()) {
    return
  }

  try {
    window.webContents.send(ipcChannels.ResourceUpdated, event)
  } catch (error) {
    console.warn('Failed to send ResourceUpdated event to window:', error)
  }
}
