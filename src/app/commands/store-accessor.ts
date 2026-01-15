import type { AppStore } from '@/app/store'

// Store reference that gets set when the app initializes
let storeInstance: AppStore | null = null

export function setStore(store: AppStore): void {
  storeInstance = store
}

export function getStore(): AppStore {
  if (!storeInstance) {
    throw new Error('Store not initialized. Is CommandContextProvider mounted?')
  }
  return storeInstance
}
