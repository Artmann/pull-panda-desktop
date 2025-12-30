export const ipcChannels = {
  AuthClearToken: 'auth:clear-token',
  AuthGetToken: 'auth:get-token',
  AuthGetUser: 'auth:get-user',
  AuthOpenUrl: 'auth:open-url',
  AuthPollToken: 'auth:poll-token',
  AuthRequestDeviceCode: 'auth:request-device-code',
  GetBootstrapData: 'get-bootstrap-data'
} as const

export type IpcChannel = (typeof ipcChannels)[keyof typeof ipcChannels]
