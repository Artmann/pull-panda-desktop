// Stub for `electron` used during vitest runs.
// Sync/database code paths import `electron` at module load to reach
// `app`/`BrowserWindow`, but vitest never actually launches Electron.
// Aliased in vitest.config.ts so the real `electron/index.js` (which throws
// at load when the binary isn't installed) is never evaluated.

const noop = (): void => undefined

export const app = {
  getPath: () => '',
  isPackaged: false,
  on: noop,
  quit: noop
}

export const safeStorage = {
  decryptString: (buffer: Buffer) => buffer.toString('utf-8'),
  encryptString: (value: string) => Buffer.from(value, 'utf-8'),
  isEncryptionAvailable: () => false
}

class BrowserWindowStub {
  static getAllWindows() {
    return [] as BrowserWindowStub[]
  }

  webContents = {
    send: noop
  }
}

export const BrowserWindow = BrowserWindowStub

export const ipcMain = {
  handle: noop,
  on: noop,
  removeAllListeners: noop,
  removeHandler: noop
}

export const ipcRenderer = {
  invoke: () => Promise.resolve(undefined),
  on: noop,
  removeAllListeners: noop,
  send: noop
}

export const contextBridge = {
  exposeInMainWorld: noop
}

export const dialog = {
  showOpenDialog: () => Promise.resolve({ canceled: true, filePaths: [] })
}

export const screen = {
  getPrimaryDisplay: () => ({ workAreaSize: { height: 0, width: 0 } })
}

export const shell = {
  openExternal: () => Promise.resolve()
}

export default {
  BrowserWindow,
  app,
  contextBridge,
  dialog,
  ipcMain,
  ipcRenderer,
  safeStorage,
  screen,
  shell
}
