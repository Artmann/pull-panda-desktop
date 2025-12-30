import { contextBridge, ipcRenderer } from 'electron'

import { ipcChannels } from './lib/ipc/channels'
import type { BootstrapData } from './main/bootstrap'
import type { DeviceCodeResponse, GitHubUser } from './types/auth'

const electronApi = {
  getBootstrapData: (): Promise<BootstrapData | null> =>
    ipcRenderer.invoke(ipcChannels.GetBootstrapData)
}

const authApi = {
  requestDeviceCode: (): Promise<DeviceCodeResponse> =>
    ipcRenderer.invoke(ipcChannels.AuthRequestDeviceCode),

  pollForToken: (
    deviceCode: string,
    interval: number
  ): Promise<{ success: boolean }> =>
    ipcRenderer.invoke(ipcChannels.AuthPollToken, deviceCode, interval),

  getToken: (): Promise<string | null> =>
    ipcRenderer.invoke(ipcChannels.AuthGetToken),

  clearToken: (): Promise<{ success: boolean }> =>
    ipcRenderer.invoke(ipcChannels.AuthClearToken),

  openUrl: (url: string): Promise<{ success: boolean }> =>
    ipcRenderer.invoke(ipcChannels.AuthOpenUrl, url),

  getUser: (): Promise<GitHubUser | null> =>
    ipcRenderer.invoke(ipcChannels.AuthGetUser)
}

contextBridge.exposeInMainWorld('electron', electronApi)
contextBridge.exposeInMainWorld('auth', authApi)

// TypeScript declarations for the exposed API
declare global {
  interface Window {
    auth: typeof authApi
    electron: typeof electronApi
  }
}
