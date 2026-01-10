import { Octokit } from '@octokit/rest'
import { Hono } from 'hono'
import { and, eq } from 'drizzle-orm'

import { getDatabase } from '../../../database'
import { pullRequests } from '../../../database/schema'
import { generateId } from '../../../sync/utils'

import type { AppEnv } from './comments'

interface CreateReviewRequest {
  owner: string
  pullNumber: number
  repo: string
}

export interface CreateReviewResponse {
  authorAvatarUrl: string | null
  authorLogin: string | null
  body: string | null
  gitHubId: string
  gitHubNumericId: number
  id: string
  state: string
}

export const reviewsRoute = new Hono<AppEnv>()

reviewsRoute.post('/', async (context) => {
  const token = context.get('token')
  const request = await context.req.json<CreateReviewRequest>()

  if (!request.owner || !request.repo || !request.pullNumber) {
    return context.json({ error: 'Missing required fields' }, 400)
  }

  const database = getDatabase()

  const pullRequest = database
    .select()
    .from(pullRequests)
    .where(
      and(
        eq(pullRequests.repositoryOwner, request.owner),
        eq(pullRequests.repositoryName, request.repo),
        eq(pullRequests.number, request.pullNumber)
      )
    )
    .get()

  if (!pullRequest) {
    return context.json({ error: 'Pull request not found' }, 404)
  }

  const octokit = new Octokit({ auth: token })

  try {
    const response = await octokit.rest.pulls.createReview({
      owner: request.owner,
      pull_number: request.pullNumber,
      repo: request.repo
      // Omitting 'event' creates a PENDING review
    })

    const data = response.data

    const reviewResponse: CreateReviewResponse = {
      authorAvatarUrl: data.user?.avatar_url ?? null,
      authorLogin: data.user?.login ?? null,
      body: data.body ?? null,
      gitHubId: data.node_id,
      gitHubNumericId: data.id,
      id: generateId(),
      state: data.state
    }

    return context.json(reviewResponse)
  } catch (error) {
    console.error('Failed to create review:', error)

    let message = 'Failed to create review'

    if (error instanceof Error) {
      if (error.message.includes('one pending review per pull request')) {
        message = 'You already have a pending review on this pull request'
      } else {
        message = error.message
      }
    }

    return context.json({ error: message }, 500)
  }
})
