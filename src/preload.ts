import { contextBridge, ipcRenderer } from 'electron'

import { ipcChannels } from './lib/ipc/channels'
import type { DetectedAgent } from './main/agents/agent-detection'
import type { AgentId, AgentSettings } from './main/agents/agent-settings'
import type { BootstrapData } from './main/bootstrap'
import type {
  ChatEvent,
  ChatMessageRecord,
  ChatSendResult,
  ChatSessionRecord
} from './types/chat'
import type {
  LogRecord,
  QueryLogsParams,
  QueryTracesParams,
  TelemetryBatch,
  TelemetryStats,
  TraceDetail,
  TraceSummary
} from './telemetry/types'
import type { DeviceCodeResponse, GitHubUser } from './types/auth'
import type { ResourceUpdatedEvent } from './types/ipc-events'
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
    ipcRenderer.invoke(ipcChannels.GetSyncerStats)
}

const telemetryApi = {
  isEnabled: (): Promise<boolean> =>
    ipcRenderer.invoke(ipcChannels.TelemetryEnabled),

  record: (batch: TelemetryBatch): Promise<void> =>
    ipcRenderer.invoke(ipcChannels.TelemetryRecord, batch),

  queryTraces: (params: QueryTracesParams): Promise<TraceSummary[]> =>
    ipcRenderer.invoke(ipcChannels.TelemetryQueryTraces, params),

  getTrace: (traceId: string): Promise<TraceDetail> =>
    ipcRenderer.invoke(ipcChannels.TelemetryGetTrace, traceId),

  queryLogs: (params: QueryLogsParams): Promise<LogRecord[]> =>
    ipcRenderer.invoke(ipcChannels.TelemetryQueryLogs, params),

  getStats: (): Promise<TelemetryStats> =>
    ipcRenderer.invoke(ipcChannels.TelemetryGetStats)
}

const usageApi = {
  getReportingEnabled: (): Promise<boolean> =>
    ipcRenderer.invoke(ipcChannels.UsageGetReportingEnabled),

  setReportingEnabled: (enabled: boolean): Promise<void> =>
    ipcRenderer.invoke(ipcChannels.UsageSetReportingEnabled, enabled)
}

const agentsApi = {
  detect: (): Promise<DetectedAgent[]> =>
    ipcRenderer.invoke(ipcChannels.AgentsDetect),

  getSettings: (): Promise<AgentSettings> =>
    ipcRenderer.invoke(ipcChannels.AgentsGetSettings),

  pickBinary: (): Promise<{ path: string | null }> =>
    ipcRenderer.invoke(ipcChannels.AgentsPickBinary),

  setDefault: (agent: AgentId | null): Promise<AgentSettings> =>
    ipcRenderer.invoke(ipcChannels.AgentsSetDefault, agent),

  setOverride: (
    agent: AgentId,
    binaryPath: string | null
  ): Promise<AgentSettings> =>
    ipcRenderer.invoke(ipcChannels.AgentsSetOverride, agent, binaryPath)
}

const chatApi = {
  getMessages: (sessionId: string): Promise<ChatMessageRecord[]> =>
    ipcRenderer.invoke(ipcChannels.ChatGetMessages, sessionId),

  getSessions: (pullRequestId: string): Promise<ChatSessionRecord[]> =>
    ipcRenderer.invoke(ipcChannels.ChatGetSessions, pullRequestId),

  onChatEvent: (callback: (event: ChatEvent) => void): (() => void) => {
    const handler = (_event: unknown, data: ChatEvent) => callback(data)

    ipcRenderer.on(ipcChannels.ChatEvent, handler)

    return () => {
      ipcRenderer.removeListener(ipcChannels.ChatEvent, handler)
    }
  },

  send: (params: {
    message: string
    pullRequestId: string
    sessionId: string | null
  }): Promise<ChatSendResult> =>
    ipcRenderer.invoke(ipcChannels.ChatSend, params),

  stop: (sessionId: string): Promise<void> =>
    ipcRenderer.invoke(ipcChannels.ChatStop, sessionId)
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
contextBridge.exposeInMainWorld('agents', agentsApi)
contextBridge.exposeInMainWorld('auth', authApi)
contextBridge.exposeInMainWorld('chat', chatApi)
contextBridge.exposeInMainWorld('telemetry', telemetryApi)
contextBridge.exposeInMainWorld('usage', usageApi)

// TypeScript declarations for the exposed API
declare global {
  interface Window {
    agents: typeof agentsApi
    auth: typeof authApi
    chat: typeof chatApi
    electron: typeof electronApi
    telemetry: typeof telemetryApi
    usage: typeof usageApi
  }
}
