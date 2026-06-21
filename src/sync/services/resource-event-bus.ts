import { BrowserWindow } from 'electron'
import { Context, Effect, Layer } from 'effect'

import { ipcChannels } from '../../lib/ipc/channels'
import { getPullRequest, getPullRequestDetails } from '../../main/bootstrap'
import { sendPullRequestResourceEvents } from '../../main/send-resource-events'

export class ResourceEventBus extends Context.Tag('sync/ResourceEventBus')<
  ResourceEventBus,
  {
    readonly emitPullRequestUpdates: (
      pullRequestId: string,
      userLogin?: string
    ) => Effect.Effect<void>
    readonly emitChecksUpdate: (pullRequestId: string) => Effect.Effect<void>
    readonly emitSyncComplete: Effect.Effect<void>
  }
>() {}

export const ResourceEventBusLive: Layer.Layer<ResourceEventBus> =
  Layer.succeed(ResourceEventBus, {
    emitPullRequestUpdates: (pullRequestId, userLogin) =>
      Effect.tryPromise({
        try: async () => {
          for (const window of BrowserWindow.getAllWindows()) {
            await sendPullRequestResourceEvents(
              window,
              pullRequestId,
              userLogin
            )
          }
        },
        catch: (error) => error
      }).pipe(Effect.catchAll(() => Effect.void)),

    emitChecksUpdate: (pullRequestId) =>
      Effect.tryPromise({
        try: async () => {
          const [details, pullRequest] = await Promise.all([
            getPullRequestDetails(pullRequestId),
            getPullRequest(pullRequestId)
          ])

          for (const window of BrowserWindow.getAllWindows()) {
            if (details) {
              window.webContents.send(ipcChannels.ResourceUpdated, {
                type: 'checks',
                pullRequestId,
                data: details.checks
              })
            }

            if (pullRequest) {
              window.webContents.send(ipcChannels.ResourceUpdated, {
                type: 'pull-request',
                pullRequestId,
                data: pullRequest
              })
            }
          }
        },
        catch: (error) => error
      }).pipe(Effect.catchAll(() => Effect.void)),

    emitSyncComplete: Effect.sync(() => {
      for (const window of BrowserWindow.getAllWindows()) {
        window.webContents.send(ipcChannels.SyncComplete, {
          type: 'pull-requests'
        })
      }
    })
  })
