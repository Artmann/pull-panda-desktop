import { Effect, Layer, Option, Ref } from 'effect'
import { describe, expect, it } from 'vitest'

import {
  commentReactions,
  comments,
  type Comment,
  type CommentReaction
} from '../../database/schema'
import { Database } from '../services/database'
import { GitHubRest } from '../services/github-rest'
import { syncComments, type SyncCommentsParams } from './sync-comments'

interface InsertRecord {
  table: 'comments' | 'commentReactions' | 'unknown'
  values: Record<string, unknown>
}

interface UpdateRecord {
  table: 'comments' | 'commentReactions' | 'unknown'
  set: Record<string, unknown>
}

interface MutationLog {
  inserts: InsertRecord[]
  updates: UpdateRecord[]
}

interface SeedRows {
  comments: ReadonlyArray<Comment>
  reactionsByCommentId: ReadonlyMap<string, ReadonlyArray<CommentReaction>>
}

const tableName = (table: unknown): InsertRecord['table'] => {
  if (table === comments) return 'comments'
  if (table === commentReactions) return 'commentReactions'

  return 'unknown'
}

// Drizzle's SQL AST has circular references; collect string/number leaves so
// tests can pattern-match against ids without depending on the AST shape.
const collectLiterals = (value: unknown, seen: WeakSet<object>): string[] => {
  if (value === null || value === undefined) {
    return []
  }

  if (typeof value === 'string') {
    return [value]
  }

  if (typeof value === 'number' || typeof value === 'boolean') {
    return [String(value)]
  }

  if (typeof value !== 'object') {
    return []
  }

  const objectValue = value as object

  if (seen.has(objectValue)) {
    return []
  }

  seen.add(objectValue)

  const literals: string[] = []

  if (Array.isArray(value)) {
    for (const entry of value) {
      literals.push(...collectLiterals(entry, seen))
    }

    return literals
  }

  for (const entry of Object.values(value as Record<string, unknown>)) {
    literals.push(...collectLiterals(entry, seen))
  }

  return literals
}

// Builds a fake drizzle `db` that returns the right pre-seeded rows depending
// on which table is the subject of the select. Inserts/updates are recorded so
// tests can assert on them.
const makeFakeDb = (seed: SeedRows, log: MutationLog) => {
  let pendingTable: 'comments' | 'commentReactions' | 'unknown' = 'unknown'
  let pendingReactionFilterCommentId: string | null = null

  const fakeDb = {
    select: () => ({
      from: (table: unknown) => {
        pendingTable = tableName(table)
        pendingReactionFilterCommentId = null

        return {
          where: (...args: unknown[]) => {
            if (pendingTable === 'commentReactions') {
              const literals = collectLiterals(args, new WeakSet())

              for (const comment of seed.comments) {
                if (literals.includes(comment.id)) {
                  pendingReactionFilterCommentId = comment.id
                  break
                }
              }
            }

            return {
              all: () => {
                if (pendingTable === 'comments') {
                  return seed.comments
                }

                if (
                  pendingTable === 'commentReactions' &&
                  pendingReactionFilterCommentId
                ) {
                  return (
                    seed.reactionsByCommentId.get(
                      pendingReactionFilterCommentId
                    ) ?? []
                  )
                }

                return []
              }
            }
          }
        }
      }
    }),
    insert: (table: unknown) => ({
      values: (values: Record<string, unknown>) => ({
        onConflictDoUpdate: () => ({
          run: () => {
            log.inserts.push({ table: tableName(table), values })
          }
        })
      })
    }),
    update: (table: unknown) => ({
      set: (set: Record<string, unknown>) => ({
        where: () => ({
          run: () => {
            log.updates.push({ table: tableName(table), set })
          }
        })
      })
    })
  }

  return fakeDb as never
}

const makeDatabaseLayer = (seed: SeedRows, log: MutationLog) =>
  Layer.succeed(Database, {
    use: <A>(_operation: string, fn: (db: never) => A) =>
      Effect.sync(() => fn(makeFakeDb(seed, log)))
  })

// Route-discriminated REST stub: issue-comments and reactions live on
// different endpoints, so the same stub must answer both for sync-comments to
// work end-to-end.
type IssueCommentResponseEntry = {
  id: number
  node_id: string
  body: string
  html_url: string
  user: { login: string; avatar_url: string; id: number }
  created_at: string
  updated_at: string
  reactions?: { url: string; total_count: number }
}

type ReactionResponseEntry = {
  id: number
  node_id: string
  content: string
  user: { login: string; id: number }
}

interface RestPlan {
  issueComments:
    | ReadonlyArray<ReadonlyArray<IssueCommentResponseEntry>>
    | 'none'
  reactionsByCommentNumericId: ReadonlyMap<
    number,
    ReadonlyArray<ReadonlyArray<ReactionResponseEntry>>
  >
}

const makeRestLayer = (plan: RestPlan, fetchedRoutes: Ref.Ref<string[]>) =>
  Layer.succeed(GitHubRest, {
    request: <A>(
      route: string,
      params: Record<string, unknown>,
      _schema: unknown,
      _options?: unknown
    ) =>
      Effect.gen(function* () {
        yield* Ref.update(fetchedRoutes, (current) => [...current, route])

        const page = (params.page as number | undefined) ?? 1

        if (route.includes('/reactions')) {
          const commentId = params.comment_id as number
          const pages = plan.reactionsByCommentNumericId.get(commentId) ?? []
          const slice = pages[page - 1] ?? []

          return Option.some(slice as unknown as A)
        }

        if (plan.issueComments === 'none') {
          return Option.none<A>()
        }

        const slice = plan.issueComments[page - 1] ?? []

        return Option.some(slice as unknown as A)
      })
  })

const params: SyncCommentsParams = {
  pullRequestId: 'PR_1',
  owner: 'octocat',
  repositoryName: 'demo',
  pullNumber: 42
}

const seededComment = (overrides: Partial<Comment>): Comment => ({
  id: 'c_existing',
  gitHubId: 'IC_existing',
  gitHubNumericId: 1,
  pullRequestId: params.pullRequestId,
  reviewId: null,
  body: 'old body',
  bodyHtml: null,
  path: null,
  line: null,
  originalLine: null,
  diffHunk: null,
  commitId: null,
  originalCommitId: null,
  gitHubReviewId: null,
  gitHubReviewThreadId: null,
  parentCommentGitHubId: null,
  userLogin: 'octocat',
  userAvatarUrl: 'https://example.com/avatar.png',
  url: 'https://github.com/octocat/demo/pull/42#issuecomment-1',
  gitHubCreatedAt: '2026-01-01T00:00:00Z',
  gitHubUpdatedAt: '2026-01-01T00:00:00Z',
  syncedAt: '2026-01-01T00:00:00Z',
  deletedAt: null,
  ...overrides
})

const seededReaction = (
  overrides: Partial<CommentReaction>
): CommentReaction => ({
  id: 'r_existing',
  gitHubId: 'REA_existing',
  commentId: 'c_existing',
  pullRequestId: params.pullRequestId,
  content: 'heart',
  userLogin: 'octocat',
  userId: '1',
  syncedAt: '2026-01-01T00:00:00Z',
  deletedAt: null,
  ...overrides
})

describe('syncComments', () => {
  it('short-circuits when the issue-comments route returns 304', async () => {
    const log: MutationLog = { inserts: [], updates: [] }
    const fetched = Ref.unsafeMake<string[]>([])

    await Effect.runPromise(
      Effect.provide(
        syncComments(params),
        Layer.mergeAll(
          makeDatabaseLayer(
            { comments: [], reactionsByCommentId: new Map() },
            log
          ),
          makeRestLayer(
            {
              issueComments: 'none',
              reactionsByCommentNumericId: new Map()
            },
            fetched
          )
        )
      )
    )

    expect(log.inserts).toEqual([])
    expect(log.updates).toEqual([])
  })

  it('soft-deletes comments that are no longer returned by the API', async () => {
    const log: MutationLog = { inserts: [], updates: [] }
    const fetched = Ref.unsafeMake<string[]>([])

    const seed: SeedRows = {
      comments: [
        seededComment({ id: 'c1', gitHubId: 'IC_1', gitHubNumericId: 1 }),
        seededComment({ id: 'c2', gitHubId: 'IC_2', gitHubNumericId: 2 })
      ],
      reactionsByCommentId: new Map()
    }

    const apiComments: ReadonlyArray<IssueCommentResponseEntry> = [
      {
        id: 1,
        node_id: 'IC_1',
        body: 'kept',
        html_url: 'https://github.com/octocat/demo/pull/42#issuecomment-1',
        user: {
          login: 'octocat',
          avatar_url: 'https://example.com/a.png',
          id: 1
        },
        created_at: '2026-02-01T00:00:00Z',
        updated_at: '2026-02-01T00:00:00Z'
      }
    ]

    await Effect.runPromise(
      Effect.provide(
        syncComments(params),
        Layer.mergeAll(
          makeDatabaseLayer(seed, log),
          makeRestLayer(
            {
              issueComments: [apiComments],
              reactionsByCommentNumericId: new Map()
            },
            fetched
          )
        )
      )
    )

    const commentDeletes = log.updates.filter(
      (entry) => entry.table === 'comments' && entry.set.deletedAt !== null
    )

    expect(commentDeletes.length).toEqual(1)
    expect(
      log.inserts.some((entry) => entry.values.gitHubId === 'IC_1')
    ).toEqual(true)
  })

  it('upserts reactions and removes stale ones when total_count > 0', async () => {
    const log: MutationLog = { inserts: [], updates: [] }
    const fetched = Ref.unsafeMake<string[]>([])

    const seed: SeedRows = {
      comments: [
        seededComment({ id: 'c1', gitHubId: 'IC_1', gitHubNumericId: 11 })
      ],
      reactionsByCommentId: new Map([
        [
          'c1',
          [
            seededReaction({
              id: 'r_old',
              gitHubId: 'REA_old',
              commentId: 'c1'
            })
          ]
        ]
      ])
    }

    const apiComments: ReadonlyArray<IssueCommentResponseEntry> = [
      {
        id: 11,
        node_id: 'IC_1',
        body: 'body',
        html_url: 'https://github.com/octocat/demo/pull/42#issuecomment-11',
        user: {
          login: 'octocat',
          avatar_url: 'https://example.com/a.png',
          id: 1
        },
        created_at: '2026-02-01T00:00:00Z',
        updated_at: '2026-02-01T00:00:00Z',
        reactions: {
          url: 'https://api.github.com/.../reactions',
          total_count: 1
        }
      }
    ]

    const apiReactions: ReadonlyArray<ReactionResponseEntry> = [
      {
        id: 99,
        node_id: 'REA_new',
        content: 'rocket',
        user: { login: 'octocat', id: 1 }
      }
    ]

    await Effect.runPromise(
      Effect.provide(
        syncComments(params),
        Layer.mergeAll(
          makeDatabaseLayer(seed, log),
          makeRestLayer(
            {
              issueComments: [apiComments],
              reactionsByCommentNumericId: new Map([[11, [apiReactions]]])
            },
            fetched
          )
        )
      )
    )

    const fetchedRoutes = await Effect.runPromise(Ref.get(fetched))

    expect(fetchedRoutes.some((route) => route.includes('/reactions'))).toEqual(
      true
    )

    expect(
      log.inserts.some(
        (entry) =>
          entry.table === 'commentReactions' &&
          entry.values.gitHubId === 'REA_new'
      )
    ).toEqual(true)

    expect(
      log.updates.some(
        (entry) =>
          entry.table === 'commentReactions' && entry.set.deletedAt !== null
      )
    ).toEqual(true)
  })

  it('reconciles reactions even when total_count is zero', async () => {
    // When GitHub reports no reactions, the sync must still mark any
    // previously stored reactions as deleted instead of leaving them stale.
    const log: MutationLog = { inserts: [], updates: [] }
    const fetched = Ref.unsafeMake<string[]>([])

    const seed: SeedRows = {
      comments: [
        seededComment({ id: 'c1', gitHubId: 'IC_1', gitHubNumericId: 11 })
      ],
      reactionsByCommentId: new Map([
        [
          'c1',
          [
            seededReaction({
              id: 'r_old',
              gitHubId: 'REA_old',
              commentId: 'c1'
            })
          ]
        ]
      ])
    }

    const apiComments: ReadonlyArray<IssueCommentResponseEntry> = [
      {
        id: 11,
        node_id: 'IC_1',
        body: 'body',
        html_url: 'https://github.com/octocat/demo/pull/42#issuecomment-11',
        user: {
          login: 'octocat',
          avatar_url: 'https://example.com/a.png',
          id: 1
        },
        created_at: '2026-02-01T00:00:00Z',
        updated_at: '2026-02-01T00:00:00Z',
        reactions: {
          url: 'https://api.github.com/.../reactions',
          total_count: 0
        }
      }
    ]

    await Effect.runPromise(
      Effect.provide(
        syncComments(params),
        Layer.mergeAll(
          makeDatabaseLayer(seed, log),
          makeRestLayer(
            {
              issueComments: [apiComments],
              reactionsByCommentNumericId: new Map()
            },
            fetched
          )
        )
      )
    )

    const fetchedRoutes = await Effect.runPromise(Ref.get(fetched))

    // Reactions endpoint should NOT be called when total_count is 0.
    expect(
      fetchedRoutes.every((route) => !route.includes('/reactions'))
    ).toEqual(true)

    // ... but the stale reaction should still get soft-deleted.
    expect(
      log.updates.some(
        (entry) =>
          entry.table === 'commentReactions' && entry.set.deletedAt !== null
      )
    ).toEqual(true)
  })
})
