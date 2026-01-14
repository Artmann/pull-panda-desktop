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

interface SubmitReviewRequest {
  body?: string
  event: 'APPROVE' | 'REQUEST_CHANGES' | 'COMMENT'
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

reviewsRoute.delete('/:reviewId', async (context) => {
  const token = context.get('token')
  const reviewId = parseInt(context.req.param('reviewId'), 10)
  const owner = context.req.query('owner')
  const repo = context.req.query('repo')
  const pullNumber = parseInt(context.req.query('pullNumber') ?? '', 10)

  if (isNaN(reviewId) || reviewId <= 0) {
    return context.json(
      { error: `Invalid review ID: ${context.req.param('reviewId')}` },
      400
    )
  }

  if (!owner || !repo || isNaN(pullNumber)) {
    return context.json({ error: 'Missing required query parameters' }, 400)
  }

  const octokit = new Octokit({ auth: token })

  try {
    await octokit.rest.pulls.deletePendingReview({
      owner,
      pull_number: pullNumber,
      repo,
      review_id: reviewId
    })

    return context.json({ success: true })
  } catch (error) {
    console.error('Failed to delete review:', error)

    const message =
      error instanceof Error ? error.message : 'Failed to delete review'

    return context.json({ error: message }, 500)
  }
})

reviewsRoute.post('/:reviewId/submit', async (context) => {
  const token = context.get('token')
  const reviewId = parseInt(context.req.param('reviewId'), 10)
  const request = await context.req.json<SubmitReviewRequest>()

  if (isNaN(reviewId) || reviewId <= 0) {
    return context.json(
      { error: `Invalid review ID: ${context.req.param('reviewId')}` },
      400
    )
  }

  if (
    !request.owner ||
    !request.repo ||
    !request.pullNumber ||
    !request.event
  ) {
    return context.json({ error: 'Missing required fields' }, 400)
  }

  const validEvents = ['APPROVE', 'REQUEST_CHANGES', 'COMMENT']

  if (!validEvents.includes(request.event)) {
    return context.json({ error: 'Invalid event type' }, 400)
  }

  const octokit = new Octokit({ auth: token })

  try {
    await octokit.rest.pulls.submitReview({
      body: request.body ?? '',
      event: request.event,
      owner: request.owner,
      pull_number: request.pullNumber,
      repo: request.repo,
      review_id: reviewId
    })

    return context.json({ success: true })
  } catch (error) {
    console.error('Failed to submit review:', error)

    const message =
      error instanceof Error ? error.message : 'Failed to submit review'

    return context.json({ error: message }, 500)
  }
})
