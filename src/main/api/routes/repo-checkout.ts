import { dialog } from 'electron'
import { Hono } from 'hono'

import { loadToken } from '../../../auth'
import { getPullRequest } from '../../bootstrap'
import {
  loadAll as loadConnectedRepos,
  removeRepoPath,
  setRepoPath
} from '../../connected-repos'
import {
  checkoutPullRequestBranch,
  cloneRepo,
  verifyRepo
} from '../../git'
import { getApiMainWindow } from '../main-window-ref'

import type { AppEnv } from './comments'

interface CheckoutBody {
  pullRequestId: string
}

interface CloneBody {
  fullName: string
  parentDir: string
}

interface SetBody {
  fullName: string
  localPath: string
}

interface VerifyBody {
  fullName: string
  localPath: string
}

interface RemoveBody {
  fullName: string
}

export const repoCheckoutRoute = new Hono<AppEnv>()

repoCheckoutRoute.post('/pick-folder', async (context) => {
  const window = getApiMainWindow()

  if (!window) {
    return context.json({ path: null })
  }

  const result = await dialog.showOpenDialog(window, {
    properties: ['openDirectory']
  })

  if (result.canceled || result.filePaths.length === 0) {
    return context.json({ path: null })
  }

  return context.json({ path: result.filePaths[0] })
})

repoCheckoutRoute.post('/verify', async (context) => {
  const body = await context.req.json<VerifyBody>()

  if (!body.fullName || !body.localPath) {
    return context.json({ error: 'Missing required fields' }, 400)
  }

  const result = await verifyRepo(body.localPath, body.fullName)

  return context.json(result)
})

repoCheckoutRoute.post('/clone', async (context) => {
  const body = await context.req.json<CloneBody>()

  if (!body.fullName || !body.parentDir) {
    return context.json({ error: 'Missing required fields' }, 400)
  }

  const token = loadToken()
  const result = await cloneRepo({
    fullName: body.fullName,
    parentDir: body.parentDir,
    token
  })

  return context.json(result)
})

repoCheckoutRoute.post('/set', async (context) => {
  const body = await context.req.json<SetBody>()

  if (!body.fullName || !body.localPath) {
    return context.json({ error: 'Missing required fields' }, 400)
  }

  setRepoPath(body.fullName, body.localPath)

  return context.json({ success: true })
})

repoCheckoutRoute.post('/remove', async (context) => {
  const body = await context.req.json<RemoveBody>()

  if (!body.fullName) {
    return context.json({ error: 'Missing required fields' }, 400)
  }

  removeRepoPath(body.fullName)

  return context.json({ success: true })
})

repoCheckoutRoute.post('/checkout', async (context) => {
  const body = await context.req.json<CheckoutBody>()

  if (!body.pullRequestId) {
    return context.json({ error: 'Missing required fields' }, 400)
  }

  const pullRequest = await getPullRequest(body.pullRequestId)

  if (!pullRequest) {
    return context.json({
      code: 'pr-not-found',
      message: 'Pull request not found in local database.',
      ok: false
    })
  }

  const fullName = `${pullRequest.repositoryOwner}/${pullRequest.repositoryName}`
  const repos = loadConnectedRepos()
  const localPath = repos[fullName]

  if (!localPath) {
    return context.json({
      code: 'not-connected',
      message: `No local clone connected for ${fullName}.`,
      ok: false
    })
  }

  const result = await checkoutPullRequestBranch({
    headRefName: pullRequest.headRefName,
    localPath,
    pullNumber: pullRequest.number
  })

  return context.json(result)
})
