import { Layer } from 'effect'

import { BackgroundSyncerLive } from './services/background-syncer'
import { DatabaseLive } from './services/database'
import { EtagStoreLive } from './services/etag-store'
import { GitHubGraphQLLive } from './services/github-graphql'
import { GitHubRestLive } from './services/github-rest'
import { RateLimitTrackerLive } from './services/rate-limit-tracker'
import { RequestBrokerLive } from './services/request-broker'
import { ResourceEventBusLive } from './services/resource-event-bus'
import { SyncRecorderLive } from './services/sync-recorder'
import { makeTokenProviderLayer } from './services/token-provider'

export const makeSyncLayer = (getToken: () => string | null) => {
  const TokenLive = makeTokenProviderLayer(getToken)

  const baseServices = Layer.mergeAll(
    DatabaseLive,
    RateLimitTrackerLive,
    RequestBrokerLive,
    TokenLive
  )

  const EtagStoreProvided = EtagStoreLive.pipe(Layer.provide(baseServices))

  const clients = Layer.mergeAll(GitHubGraphQLLive, GitHubRestLive).pipe(
    Layer.provide(Layer.mergeAll(baseServices, EtagStoreProvided))
  )

  const recorder = SyncRecorderLive.pipe(Layer.provide(baseServices))

  const supportServices = Layer.mergeAll(
    baseServices,
    EtagStoreProvided,
    clients,
    recorder,
    ResourceEventBusLive
  )

  const scheduler = BackgroundSyncerLive.pipe(Layer.provide(supportServices))

  return Layer.mergeAll(supportServices, scheduler)
}

export type SyncLayer = ReturnType<typeof makeSyncLayer>
