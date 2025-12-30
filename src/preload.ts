import { contextBridge, ipcRenderer } from 'electron'
import { IPC_CHANNELS } from './lib/ipc/channels'
import type { DeviceCodeResponse, GitHubUser } from './types/auth'

const authApi = {
  requestDeviceCode: (): Promise<DeviceCodeResponse> =>
    ipcRenderer.invoke(IPC_CHANNELS.AUTH_REQUEST_DEVICE_CODE),

  pollForToken: (
    deviceCode: string,
    interval: number
  ): Promise<{ success: boolean }> =>
    ipcRenderer.invoke(IPC_CHANNELS.AUTH_POLL_TOKEN, deviceCode, interval),

  getToken: (): Promise<string | null> =>
    ipcRenderer.invoke(IPC_CHANNELS.AUTH_GET_TOKEN),

  clearToken: (): Promise<{ success: boolean }> =>
    ipcRenderer.invoke(IPC_CHANNELS.AUTH_CLEAR_TOKEN),

  openUrl: (url: string): Promise<{ success: boolean }> =>
    ipcRenderer.invoke(IPC_CHANNELS.AUTH_OPEN_URL, url),

  getUser: (): Promise<GitHubUser | null> =>
    ipcRenderer.invoke(IPC_CHANNELS.AUTH_GET_USER)
}

contextBridge.exposeInMainWorld('auth', authApi)

// TypeScript declarations for the exposed API
declare global {
  interface Window {
    auth: typeof authApi
  }
}
