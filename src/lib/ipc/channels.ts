export const IPC_CHANNELS = {
  AUTH_REQUEST_DEVICE_CODE: 'auth:request-device-code',
  AUTH_POLL_TOKEN: 'auth:poll-token',
  AUTH_GET_TOKEN: 'auth:get-token',
  AUTH_CLEAR_TOKEN: 'auth:clear-token',
  AUTH_OPEN_URL: 'auth:open-url',
  AUTH_GET_USER: 'auth:get-user'
} as const

export type IpcChannel = (typeof IPC_CHANNELS)[keyof typeof IPC_CHANNELS]
