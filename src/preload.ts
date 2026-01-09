import { contextBridge, ipcRenderer } from 'electron'

import { ipcChannels } from './lib/ipc/channels'
import type { BootstrapData } from './main/bootstrap'
import type { DeviceCodeResponse, GitHubUser } from './types/auth'
import type { PullRequestDetails } from './types/pullRequestDetails'
import type { Task, TaskUpdateEvent } from './types/task'

interface SyncCompleteEvent {
  type: 'pull-requests' | 'pull-request-details'
  pullRequestId?: string
}

const electronApi = {
  getApiPort: (): Promise<number | null> =>
    ipcRenderer.invoke(ipcChannels.ApiGetPort),

  getBootstrapData: (): Promise<BootstrapData | null> =>
    ipcRenderer.invoke(ipcChannels.GetBootstrapData),

  getPullRequestDetails: (
    pullRequestId: string
  ): Promise<PullRequestDetails | null> =>
    ipcRenderer.invoke(ipcChannels.GetPullRequestDetails, pullRequestId),

  syncPullRequestDetails: (
    pullRequestId: string,
    owner: string,
    repositoryName: string,
    pullNumber: number
  ): Promise<{ success: boolean; errors: string[] }> =>
    ipcRenderer.invoke(
      ipcChannels.SyncPullRequestDetails,
      pullRequestId,
      owner,
      repositoryName,
      pullNumber
    ),

  onSyncComplete: (callback: (event: SyncCompleteEvent) => void): (() => void) => {
    const handler = (_event: unknown, data: SyncCompleteEvent) => callback(data)

    ipcRenderer.on(ipcChannels.SyncComplete, handler)

    return () => {
      ipcRenderer.removeListener(ipcChannels.SyncComplete, handler)
    }
  },

  getTasks: (): Promise<Task[]> => ipcRenderer.invoke(ipcChannels.GetTasks),

  onTaskUpdate: (callback: (event: TaskUpdateEvent) => void): (() => void) => {
    const handler = (_event: unknown, data: TaskUpdateEvent) => callback(data)

    ipcRenderer.on(ipcChannels.TaskUpdate, handler)

    return () => {
      ipcRenderer.removeListener(ipcChannels.TaskUpdate, handler)
    }
  },

  windowClose: (): Promise<void> =>
    ipcRenderer.invoke(ipcChannels.WindowClose),

  windowMaximize: (): Promise<void> =>
    ipcRenderer.invoke(ipcChannels.WindowMaximize),

  windowMinimize: (): Promise<void> =>
    ipcRenderer.invoke(ipcChannels.WindowMinimize),

  openUrl: (url: string): Promise<{ success: boolean }> =>
    ipcRenderer.invoke(ipcChannels.OpenUrl, url)
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
