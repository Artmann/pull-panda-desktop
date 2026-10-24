// The complete catalog of product analytics events. Every property is a fixed
// value, a count or a flag - never free text - so an event can't carry a repo
// name, a pull request title, code or anything else that identifies a person
// or their work. Add new events here rather than passing loose objects.

export type CountBucket = '0' | '1' | '2-5' | '6-20' | '21-100' | '100+'

export type ProductScreen =
  | 'background_syncer'
  | 'home'
  | 'onboarding'
  | 'pull_request'
  | 'settings'
  | 'sign_in'
  | 'telemetry'

// Events the renderer may send through IPC.
export type RendererProductEvent =
  | { name: 'auto_merge_enabled' }
  | { name: 'branch_checked_out' }
  | {
      name: 'command_run'
      properties: { command: string; source: 'palette' | 'shortcut' }
    }
  | { name: 'comment_posted'; properties: { kind: 'conversation' | 'reply' } }
  | { name: 'merge_queue_joined' }
  | {
      name: 'pull_request_merged'
      properties: { method: 'merge' | 'rebase' | 'squash' }
    }
  | { name: 'repo_connected' }
  | {
      name: 'review_submitted'
      properties: {
        commentCount: CountBucket
        verdict: 'approve' | 'comment' | 'request_changes'
      }
    }
  | { name: 'reviewers_requested'; properties: { count: CountBucket } }
  | { name: 'screen_viewed'; properties: { screen: ProductScreen } }
  | { name: 'signed_in' }
  | { name: 'signed_out' }
  | { name: 'thread_resolved' }

// Events only the main process sends.
type MainProductEvent =
  | {
      name: 'app_opened'
      properties: {
        openPullRequestCount: CountBucket
        repositoryCount: CountBucket
      }
    }
  | { name: 'app_active' }

export type ProductEvent = MainProductEvent | RendererProductEvent

export const rendererProductEventNames: ReadonlyArray<
  RendererProductEvent['name']
> = [
  'auto_merge_enabled',
  'branch_checked_out',
  'command_run',
  'comment_posted',
  'merge_queue_joined',
  'pull_request_merged',
  'repo_connected',
  'review_submitted',
  'reviewers_requested',
  'screen_viewed',
  'signed_in',
  'signed_out',
  'thread_resolved'
]

export function toCountBucket(count: number): CountBucket {
  if (count <= 0) {
    return '0'
  }

  if (count === 1) {
    return '1'
  }

  if (count <= 5) {
    return '2-5'
  }

  if (count <= 20) {
    return '6-20'
  }

  if (count <= 100) {
    return '21-100'
  }

  return '100+'
}
