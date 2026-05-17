import { dialog } from 'electron'
import { Effect } from 'effect'

import { AuthStore } from '../../services/auth-store'
import { Git } from '../../services/git'
import { MainWindow } from '../../services/main-window'
import { Repository } from '../../services/repository'
import {
  loadAll as loadConnectedRepos,
  removeRepoPath,
  setRepoPath
} from '../../connected-repos'

export const pickFolder = Effect.gen(function* () {
  const mainWindow = yield* MainWindow
  const window = yield* mainWindow.get

  if (!window) {
    return { path: null }
  }

  const result = yield* Effect.promise(() =>
    dialog.showOpenDialog(window, { properties: ['openDirectory'] })
  )

  if (result.canceled || result.filePaths.length === 0) {
    return { path: null }
  }

  return { path: result.filePaths[0] }
})

export const verifyConnectedRepo = (input: {
  readonly fullName: string
  readonly localPath: string
}) =>
  Effect.gen(function* () {
    const git = yield* Git

    return yield* git.verifyRepo(input)
  })

export const cloneRepository = (input: {
  readonly fullName: string
  readonly parentDir: string
}) =>
  Effect.gen(function* () {
    const git = yield* Git
    const authStore = yield* AuthStore

    const token = yield* authStore.load

    return yield* git.cloneRepo({
      fullName: input.fullName,
      parentDir: input.parentDir,
      token
    })
  })

export const setConnectedRepo = (input: {
  readonly fullName: string
  readonly localPath: string
}) =>
  Effect.sync(() => {
    setRepoPath(input.fullName, input.localPath)

    return { success: true } as const
  })

export const removeConnectedRepo = (input: { readonly fullName: string }) =>
  Effect.sync(() => {
    removeRepoPath(input.fullName)

    return { success: true } as const
  })

export const checkoutPullRequest = (pullRequestId: string) =>
  Effect.gen(function* () {
    const repository = yield* Repository
    const git = yield* Git

    const pullRequest = yield* repository.findPullRequestById(pullRequestId)

    if (!pullRequest) {
      return {
        code: 'pr-not-found' as const,
        message: 'Pull request not found in local database.',
        ok: false as const
      }
    }

    const fullName = `${pullRequest.repositoryOwner}/${pullRequest.repositoryName}`
    const repos = loadConnectedRepos()
    const localPath = repos[fullName]

    if (!localPath) {
      return {
        code: 'not-connected' as const,
        message: `No local clone connected for ${fullName}.`,
        ok: false as const
      }
    }

    return yield* git.checkoutPullRequestBranch({
      headRefName: pullRequest.headRefName,
      localPath,
      pullNumber: pullRequest.number
    })
  })
