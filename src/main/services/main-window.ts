import type { BrowserWindow } from 'electron'
import { Context, Effect, Layer } from 'effect'

import { ipcChannels } from '../../lib/ipc/channels'
import { getApiMainWindow, setApiMainWindow } from '../api/main-window-ref'

export class MainWindow extends Context.Tag('main/MainWindow')<
  MainWindow,
  {
    readonly get: Effect.Effect<BrowserWindow | null>
    readonly send: <Payload>(
      channel: string,
      payload: Payload
    ) => Effect.Effect<void>
    readonly set: (window: BrowserWindow) => Effect.Effect<void>
  }
>() {}

export const MainWindowLive: Layer.Layer<MainWindow> = Layer.succeed(
  MainWindow,
  {
    get: Effect.sync(() => getApiMainWindow()),
    set: (window) => Effect.sync(() => setApiMainWindow(window)),
    send: (channel, payload) =>
      Effect.sync(() => {
        const window = getApiMainWindow()

        if (
          !window ||
          window.isDestroyed() ||
          window.webContents.isDestroyed()
        ) {
          return
        }

        window.webContents.send(channel, payload)
      })
  }
)

export { ipcChannels }
