import { contextBridge, ipcRenderer } from 'electron'

import { ipcChannels } from './lib/ipc/channels'
import type { BootstrapData } from './main/bootstrap'
import type { DeviceCodeResponse, GitHubUser } from './types/auth'
import type { ResourceUpdatedEvent } from './types/ipc-events'
import type {
  CheckoutPullRequestArgs,
  CheckoutPullRequestResult,
  CloneRepoArgs,
  CloneRepoResult,
  PickFolderResult,
  SetConnectedRepoArgs,
  VerifyRepoArgs,
  VerifyRepoResult
} from './types/repo-checkout'
import type { MonitoringData } from './types/syncer-monitoring'
import type { Task, TaskUpdateEvent } from './types/task'

const electronApi = {
  getApiPort: (): Promise<number | null> =>
    ipcRenderer.invoke(ipcChannels.ApiGetPort),

  getBootstrapData: (): Promise<BootstrapData | null> =>
    ipcRenderer.invoke(ipcChannels.GetBootstrapData),

  onSyncComplete: (callback: () => void): (() => void) => {
    const handler = () => callback()

    ipcRenderer.on(ipcChannels.SyncComplete, handler)

    return () => {
      ipcRenderer.removeListener(ipcChannels.SyncComplete, handler)
    }
  },

  onNavigateTo: (callback: (path: string) => void): (() => void) => {
    const handler = (_event: unknown, path: string) => callback(path)

    ipcRenderer.on(ipcChannels.NavigateTo, handler)

    return () => {
      ipcRenderer.removeListener(ipcChannels.NavigateTo, handler)
    }
  },

  onResourceUpdated: (
    callback: (event: ResourceUpdatedEvent) => void
  ): (() => void) => {
    const handler = (_event: unknown, data: ResourceUpdatedEvent) =>
      callback(data)

    ipcRenderer.on(ipcChannels.ResourceUpdated, handler)

    return () => {
      ipcRenderer.removeListener(ipcChannels.ResourceUpdated, handler)
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

  windowClose: (): Promise<void> => ipcRenderer.invoke(ipcChannels.WindowClose),

  windowMaximize: (): Promise<void> =>
    ipcRenderer.invoke(ipcChannels.WindowMaximize),

  windowMinimize: (): Promise<void> =>
    ipcRenderer.invoke(ipcChannels.WindowMinimize),

  openUrl: (url: string): Promise<{ success: boolean }> =>
    ipcRenderer.invoke(ipcChannels.OpenUrl, url),

  getSyncerStats: (): Promise<MonitoringData> =>
    ipcRenderer.invoke(ipcChannels.GetSyncerStats),

  repoCheckout: {
    checkout: (
      args: CheckoutPullRequestArgs
    ): Promise<CheckoutPullRequestResult> =>
      ipcRenderer.invoke(ipcChannels.RepoCheckoutCheckout, args),

    clone: (args: CloneRepoArgs): Promise<CloneRepoResult> =>
      ipcRenderer.invoke(ipcChannels.RepoCheckoutClone, args),

    pickFolder: (): Promise<PickFolderResult> =>
      ipcRenderer.invoke(ipcChannels.RepoCheckoutPickFolder),

    remove: (fullName: string): Promise<void> =>
      ipcRenderer.invoke(ipcChannels.RepoCheckoutRemove, fullName),

    set: (args: SetConnectedRepoArgs): Promise<void> =>
      ipcRenderer.invoke(ipcChannels.RepoCheckoutSet, args),

    verify: (args: VerifyRepoArgs): Promise<VerifyRepoResult> =>
      ipcRenderer.invoke(ipcChannels.RepoCheckoutVerify, args)
  }
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
