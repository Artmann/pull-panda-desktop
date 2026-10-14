import { describe, expect, it } from 'vitest'

import { firstPlainLine, markdownToPlainText } from './plain-text'

describe('markdownToPlainText', () => {
  it('keeps link text and drops images, tags and emphasis', () => {
    expect(
      markdownToPlainText(
        '![badge](x.svg) **Final Result:** see [the agent](https://x.dev) <br/> now'
      )
    ).toEqual('Final Result: see the agent now')
  })

  it('reads escaped punctuation as the character itself', () => {
    expect(
      markdownToPlainText(
        '**warn** `fallow/css-token-drift`: \\[css-token-drift\\] border-\\[1.5px\\]'
      )
    ).toEqual('warn fallow/css-token-drift: [css-token-drift] border-[1.5px]')
  })
})

describe('firstPlainLine', () => {
  it('returns the first line that has words in it', () => {
    expect(
      firstPlainLine('\n![logo](a.png)\nBugbot Analysis Progress\nMore')
    ).toEqual('Bugbot Analysis Progress')
  })

  it('returns null when there is nothing to show', () => {
    expect([firstPlainLine(null), firstPlainLine('  \n')]).toEqual([null, null])
  })
})
