import { Effect } from 'effect'

import type { Comment, NewComment } from '../../database/schema'

// Edits the user makes in the app go to GitHub and then straight into the
// database. A sync that fetched the same record before the edit landed would
// otherwise write the old text back over it, and the renderer would show the
// edit flick back until the next sync. Edits register here while they run, so
// the sync can tell when what it fetched is older than what is stored.

interface LocalWrite {
  // Edits of this record still waiting on GitHub.
  active: number
  // When the most recent edit of this record finished, in milliseconds.
  finishedAt: number
}

const writes = new Map<string, LocalWrite>()

export const localWriteKeys = {
  comment: (gitHubId: string) => `comment:${gitHubId}`,
  pullRequest: (pullRequestId: string) => `pull-request:${pullRequestId}`
}

/**
 * Whether a local edit of the record was running at any point after `since`,
 * a timestamp taken before the sync sent its request. When it was, the
 * response may predate the edit and must not replace the stored text.
 */
export function hasLocalWriteSince(key: string, since: number): boolean {
  const write = writes.get(key)

  if (!write) {
    return false
  }

  return write.active > 0 || write.finishedAt >= since
}

/**
 * The comment row a sync is about to store, with the stored body kept when
 * the user edited the comment in the app after `fetchedAt`.
 */
export function keepLocallyEditedBody(
  row: NewComment,
  existing: Comment | undefined,
  fetchedAt: number
): NewComment {
  if (
    !existing ||
    !hasLocalWriteSince(localWriteKeys.comment(row.gitHubId), fetchedAt)
  ) {
    return row
  }

  return { ...row, body: existing.body, bodyHtml: existing.bodyHtml }
}

/** Runs `effect` as a local edit of the record under `key`. */
export const trackLocalWrite = <A, E, R>(
  key: string,
  effect: Effect.Effect<A, E, R>
): Effect.Effect<A, E, R> =>
  Effect.acquireUseRelease(
    Effect.sync(() => {
      const write = writes.get(key) ?? { active: 0, finishedAt: 0 }

      write.active += 1
      writes.set(key, write)

      return write
    }),
    () => effect,
    (write) =>
      Effect.sync(() => {
        write.active -= 1
        write.finishedAt = Date.now()
      })
  )
