export const ipcChannels = {
  ApiGetPort: 'api:get-port',
  AuthClearToken: 'auth:clear-token',
  AuthGetToken: 'auth:get-token',
  AuthGetUser: 'auth:get-user',
  AuthOpenUrl: 'auth:open-url',
  AuthPollToken: 'auth:poll-token',
  AuthRequestDeviceCode: 'auth:request-device-code',
  GetBootstrapData: 'get-bootstrap-data',
  GetPullRequestDetails: 'get-pull-request-details',
  GetSyncerStats: 'syncer:get-stats',
  GetTasks: 'tasks:get',
  OpenUrl: 'shell:open-url',
  PullRequestOpened: 'pull-request:opened',
  SyncComplete: 'sync:complete',
  SyncPullRequestDetails: 'sync:pull-request-details',
  TaskUpdate: 'tasks:update',
  WindowClose: 'window:close',
  WindowMaximize: 'window:maximize',
  WindowMinimize: 'window:minimize'
} as const

export type IpcChannel = (typeof ipcChannels)[keyof typeof ipcChannels]
