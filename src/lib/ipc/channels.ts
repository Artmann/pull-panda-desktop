export const ipcChannels = {
  AuthClearToken: 'auth:clear-token',
  AuthGetToken: 'auth:get-token',
  AuthGetUser: 'auth:get-user',
  AuthOpenUrl: 'auth:open-url',
  AuthPollToken: 'auth:poll-token',
  AuthRequestDeviceCode: 'auth:request-device-code',
  GetBootstrapData: 'get-bootstrap-data',
  WindowClose: 'window:close',
  WindowMaximize: 'window:maximize',
  WindowMinimize: 'window:minimize'
} as const

export type IpcChannel = (typeof ipcChannels)[keyof typeof ipcChannels]
