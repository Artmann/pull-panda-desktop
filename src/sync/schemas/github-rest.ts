import { Schema } from 'effect'

export const PullRequestHeadShaSchema = Schema.Struct({
  head: Schema.Struct({ sha: Schema.String })
})

const CheckRunSchema = Schema.Struct({
  id: Schema.Number,
  name: Schema.String,
  status: Schema.NullOr(Schema.String),
  conclusion: Schema.NullOr(Schema.String),
  started_at: Schema.NullOr(Schema.String),
  completed_at: Schema.NullOr(Schema.String),
  details_url: Schema.NullOr(Schema.String),
  head_sha: Schema.String,
  output: Schema.optional(
    Schema.Struct({
      title: Schema.optional(Schema.NullOr(Schema.String)),
      summary: Schema.optional(Schema.NullOr(Schema.String))
    })
  ),
  check_suite: Schema.optional(Schema.Struct({ id: Schema.Number })),
  app: Schema.optional(Schema.Struct({ name: Schema.optional(Schema.String) }))
})

export type CheckRun = Schema.Schema.Type<typeof CheckRunSchema>

export const CheckRunsResponseSchema = Schema.Struct({
  total_count: Schema.Number,
  check_runs: Schema.Array(CheckRunSchema)
})

const CommitSchema = Schema.Struct({
  sha: Schema.String,
  commit: Schema.Struct({
    message: Schema.String,
    author: Schema.optional(
      Schema.Struct({
        name: Schema.optional(Schema.String),
        date: Schema.optional(Schema.String)
      })
    )
  }),
  html_url: Schema.optional(Schema.String),
  author: Schema.optional(
    Schema.NullOr(
      Schema.Struct({
        login: Schema.optional(Schema.String),
        avatar_url: Schema.optional(Schema.String)
      })
    )
  )
})

export type Commit = Schema.Schema.Type<typeof CommitSchema>

export const CommitsResponseSchema = Schema.Array(CommitSchema)

const FileSchema = Schema.Struct({
  filename: Schema.String,
  status: Schema.optional(Schema.String),
  additions: Schema.optional(Schema.Number),
  deletions: Schema.optional(Schema.Number),
  changes: Schema.optional(Schema.Number),
  patch: Schema.optional(Schema.String)
})

export type ModifiedFile = Schema.Schema.Type<typeof FileSchema>

export const FilesResponseSchema = Schema.Array(FileSchema)

const ReactionSchema = Schema.Struct({
  id: Schema.Number,
  node_id: Schema.String,
  content: Schema.String,
  user: Schema.NullOr(
    Schema.Struct({
      login: Schema.String,
      id: Schema.Number
    })
  )
})

export type Reaction = Schema.Schema.Type<typeof ReactionSchema>

export const ReactionsResponseSchema = Schema.Array(ReactionSchema)

const IssueCommentSchema = Schema.Struct({
  id: Schema.Number,
  node_id: Schema.String,
  body: Schema.String,
  body_html: Schema.optional(Schema.String),
  html_url: Schema.String,
  user: Schema.NullOr(
    Schema.Struct({
      login: Schema.String,
      avatar_url: Schema.String,
      id: Schema.Number
    })
  ),
  created_at: Schema.String,
  updated_at: Schema.String,
  reactions: Schema.optional(
    Schema.Struct({
      url: Schema.String,
      total_count: Schema.Number
    })
  )
})

export type IssueComment = Schema.Schema.Type<typeof IssueCommentSchema>

export const IssueCommentsResponseSchema = Schema.Array(IssueCommentSchema)

const ReviewSchema = Schema.Struct({
  id: Schema.Number,
  node_id: Schema.String,
  state: Schema.String,
  body: Schema.NullOr(Schema.String),
  body_html: Schema.optional(Schema.String),
  html_url: Schema.String,
  user: Schema.NullOr(
    Schema.Struct({
      login: Schema.String,
      avatar_url: Schema.String
    })
  ),
  submitted_at: Schema.NullOr(Schema.String),
  commit_id: Schema.NullOr(Schema.String)
})

export type Review = Schema.Schema.Type<typeof ReviewSchema>

export const ReviewsResponseSchema = Schema.Array(ReviewSchema)

const ReviewCommentSchema = Schema.Struct({
  id: Schema.Number,
  node_id: Schema.String,
  pull_request_review_id: Schema.NullOr(Schema.Number),
  body: Schema.String,
  body_html: Schema.optional(Schema.String),
  path: Schema.String,
  line: Schema.NullOr(Schema.Number),
  original_line: Schema.NullOr(Schema.Number),
  diff_hunk: Schema.String,
  commit_id: Schema.String,
  original_commit_id: Schema.String,
  in_reply_to_id: Schema.optional(Schema.Number),
  user: Schema.NullOr(
    Schema.Struct({
      login: Schema.String,
      avatar_url: Schema.String,
      id: Schema.Number
    })
  ),
  html_url: Schema.String,
  created_at: Schema.String,
  updated_at: Schema.String,
  reactions: Schema.optional(
    Schema.Struct({
      url: Schema.String,
      total_count: Schema.Number
    })
  )
})

export type ReviewComment = Schema.Schema.Type<typeof ReviewCommentSchema>

export const ReviewCommentsResponseSchema = Schema.Array(ReviewCommentSchema)
