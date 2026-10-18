import { Effect } from 'effect'
import { describe, expect, it } from 'vitest'

import type { Comment, NewComment } from '../../database/schema'
import {
  hasLocalWriteSince,
  keepLocallyEditedBody,
  localWriteKeys,
  trackLocalWrite
} from './local-writes'

describe('local writes', () => {
  it('reports nothing for a record that was never edited', () => {
    expect(hasLocalWriteSince('never-edited', 0)).toEqual(false)
  })

  it('reports an edit while it is still running', async () => {
    let duringEdit: boolean | null = null

    await Effect.runPromise(
      trackLocalWrite(
        'running',
        Effect.sync(() => {
          duringEdit = hasLocalWriteSince('running', Date.now() + 1000)
        })
      )
    )

    expect(duringEdit).toEqual(true)
  })

  it('reports an edit that finished after the given time, and none before it', async () => {
    const before = Date.now()

    await Effect.runPromise(trackLocalWrite('finished', Effect.void))

    expect(hasLocalWriteSince('finished', before)).toEqual(true)
    expect(hasLocalWriteSince('finished', Date.now() + 1000)).toEqual(false)
  })

  it('keeps the stored comment body only when it was edited after the fetch', async () => {
    const fetchedAt = Date.now()
    const existing = { body: 'Edited', bodyHtml: '<p>Edited</p>' } as Comment
    const edited = {
      body: 'Fetched',
      bodyHtml: null,
      gitHubId: 'IC_1'
    } as NewComment
    const untouched = { ...edited, gitHubId: 'IC_2' }

    await Effect.runPromise(
      trackLocalWrite(localWriteKeys.comment('IC_1'), Effect.void)
    )

    expect(keepLocallyEditedBody(edited, existing, fetchedAt)).toEqual({
      ...edited,
      body: 'Edited',
      bodyHtml: '<p>Edited</p>'
    })
    expect(keepLocallyEditedBody(untouched, existing, fetchedAt)).toEqual(
      untouched
    )
  })

  it('finishes the edit when it fails', async () => {
    await Effect.runPromiseExit(trackLocalWrite('failing', Effect.fail('boom')))

    expect(hasLocalWriteSince('failing', Date.now() + 1000)).toEqual(false)
  })
})
