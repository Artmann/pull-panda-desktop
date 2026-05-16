import { Schema } from 'effect'

const PullRequestStateSchema = Schema.Literal('OPEN', 'CLOSED', 'MERGED')

export const RateLimitSchema = Schema.Struct({
  cost: Schema.Number,
  limit: Schema.Number,
  remaining: Schema.Number,
  resetAt: Schema.String
})

const LabelSchema = Schema.Struct({
  name: Schema.String,
  color: Schema.String
})

const AssigneeSchema = Schema.Struct({
  login: Schema.String,
  avatarUrl: Schema.String
})

const RequestedReviewerNodeSchema = Schema.Struct({
  requestedReviewer: Schema.NullOr(
    Schema.Union(
      Schema.Struct({
        __typename: Schema.Literal('User', 'Bot'),
        login: Schema.String,
        avatarUrl: Schema.String
      }),
      Schema.Struct({ __typename: Schema.String })
    )
  )
})

const AuthorSchema = Schema.Struct({
  login: Schema.String,
  avatarUrl: Schema.String
})

const RepositorySchema = Schema.Struct({
  name: Schema.String,
  owner: Schema.Struct({ login: Schema.String })
})

const PullRequestNodeSchema = Schema.Struct({
  __typename: Schema.String,
  id: Schema.String,
  number: Schema.Number,
  title: Schema.String,
  body: Schema.NullOr(Schema.String),
  bodyHTML: Schema.String,
  headRefName: Schema.String,
  state: PullRequestStateSchema,
  isDraft: Schema.Boolean,
  url: Schema.String,
  createdAt: Schema.String,
  updatedAt: Schema.String,
  closedAt: Schema.NullOr(Schema.String),
  mergedAt: Schema.NullOr(Schema.String),
  repository: RepositorySchema,
  author: Schema.NullOr(AuthorSchema),
  labels: Schema.Struct({ nodes: Schema.Array(LabelSchema) }),
  assignees: Schema.Struct({ nodes: Schema.Array(AssigneeSchema) }),
  reviewRequests: Schema.Struct({
    nodes: Schema.Array(RequestedReviewerNodeSchema)
  })
})

export type PullRequestNode = Schema.Schema.Type<typeof PullRequestNodeSchema>

const ProbeNodeSchema = Schema.Struct({
  __typename: Schema.String,
  id: Schema.String,
  updatedAt: Schema.String,
  state: PullRequestStateSchema
})

const ProbeBucketSchema = Schema.Struct({
  nodes: Schema.Array(ProbeNodeSchema)
})

export const ProbeResponseSchema = Schema.Struct({
  authored: ProbeBucketSchema,
  assigned: ProbeBucketSchema,
  reviewRequested: ProbeBucketSchema,
  rateLimit: RateLimitSchema
})

export const MultiAliasResponseSchema = Schema.Struct({
  rateLimit: RateLimitSchema
}).pipe(
  Schema.extend(
    Schema.Record({
      key: Schema.String,
      value: Schema.Union(PullRequestNodeSchema, RateLimitSchema, Schema.Null)
    })
  )
)

const ReviewThreadCommentSchema = Schema.Struct({
  id: Schema.String,
  databaseId: Schema.NullOr(Schema.Number)
})

const ReviewThreadNodeSchema = Schema.Struct({
  id: Schema.String,
  isResolved: Schema.Boolean,
  resolvedBy: Schema.NullOr(Schema.Struct({ login: Schema.String })),
  comments: Schema.Struct({
    nodes: Schema.Array(ReviewThreadCommentSchema)
  })
})

export type ReviewThreadNode = Schema.Schema.Type<typeof ReviewThreadNodeSchema>

export const ReviewThreadsResponseSchema = Schema.Struct({
  repository: Schema.NullOr(
    Schema.Struct({
      pullRequest: Schema.NullOr(
        Schema.Struct({
          reviewThreads: Schema.Struct({
            pageInfo: Schema.Struct({
              hasNextPage: Schema.Boolean,
              endCursor: Schema.NullOr(Schema.String)
            }),
            nodes: Schema.Array(ReviewThreadNodeSchema)
          })
        })
      )
    })
  ),
  rateLimit: RateLimitSchema
})
