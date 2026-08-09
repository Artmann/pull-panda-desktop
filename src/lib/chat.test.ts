import { describe, expect, it } from 'vitest'

import { contentWithoutFailureMessage } from './chat'

describe('contentWithoutFailureMessage', () => {
  it('empties content that is only the failure message', () => {
    expect(
      contentWithoutFailureMessage(
        "You've hit your session limit · resets 11:40pm (Europe/Madrid)",
        "You've hit your session limit · resets 11:40pm (Europe/Madrid)"
      )
    ).toEqual('')
  })

  it('keeps the partial answer and drops the trailing failure message', () => {
    expect(
      contentWithoutFailureMessage(
        'This pull request adds a splitter.\n\nThe agent ran out of turns.',
        'The agent ran out of turns.'
      )
    ).toEqual('This pull request adds a splitter.')
  })

  it('keeps content that does not end with the failure message', () => {
    expect(
      contentWithoutFailureMessage(
        'This pull request adds a splitter.',
        'The agent exited unexpectedly (code 1).'
      )
    ).toEqual('This pull request adds a splitter.')
  })

  it('keeps content when the failure message is blank', () => {
    expect(contentWithoutFailureMessage('Partial answer', '   ')).toEqual(
      'Partial answer'
    )
  })
})
