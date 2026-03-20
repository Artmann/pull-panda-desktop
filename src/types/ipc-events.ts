import type { PullRequest } from './pull-request'
import type {
  Check,
  Comment,
  CommentReaction,
  Commit,
  ModifiedFile,
  Review
} from './pull-request-details'
import type { PendingReview } from '../main/bootstrap'

export type RequestPullRequestSyncResult =
  | { ok: true }
  | { ok: false; reason: 'no_token' | 'already_syncing' }

export type ResourceUpdatedEvent =
  | { data: Check[]; pullRequestId: string; type: 'checks' }
  | { data: Comment[]; pullRequestId: string; type: 'comments' }
  | { data: Commit[]; pullRequestId: string; type: 'commits' }
  | { data: ModifiedFile[]; pullRequestId: string; type: 'modified-files' }
  | {
      data: PendingReview | null
      pullRequestId: string
      type: 'pending-review'
    }
  | { data: PullRequest; pullRequestId: string; type: 'pull-request' }
  | { data: PullRequest[]; type: 'pull-requests' }
  | { data: CommentReaction[]; pullRequestId: string; type: 'reactions' }
  | { data: Review[]; pullRequestId: string; type: 'reviews' }
