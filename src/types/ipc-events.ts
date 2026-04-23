import type { PullRequest } from './pull-request'
import type {
  Check,
  Comment,
  CommentReaction,
  Commit,
  ModifiedFile,
  Review,
  ReviewThread
} from './pull-request-details'
import type { PendingReview } from '../main/bootstrap'

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
  | { data: ReviewThread[]; pullRequestId: string; type: 'review-threads' }
