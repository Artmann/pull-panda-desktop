import { Layer } from 'effect'

import { AuthStoreLive } from '../main/services/auth-store'
import { CodeownersLive } from '../main/services/codeowners'
import { GitLive } from '../main/services/git'
import { GitHubApiLive } from '../main/services/github-api'
import { GitHubAuthLive } from '../main/services/github-auth'
import { MainWindowLive } from '../main/services/main-window'
import { RepositoryLive } from '../main/services/repository'
import { TaskManagerLive } from '../main/services/task-manager'
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

export const makeAppLayer = (getToken: () => string | null) => {
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

  const repository = RepositoryLive.pipe(Layer.provide(baseServices))

  const apiServices = Layer.mergeAll(
    AuthStoreLive,
    CodeownersLive,
    GitLive,
    GitHubApiLive,
    GitHubAuthLive,
    MainWindowLive,
    TaskManagerLive
  )

  return Layer.mergeAll(supportServices, scheduler, repository, apiServices)
}

export type AppLayer = ReturnType<typeof makeAppLayer>
