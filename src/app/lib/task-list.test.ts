import { describe, expect, it } from 'vitest'

import { toggleTaskListItem } from './task-list'

describe('toggleTaskListItem', () => {
  it('checks an unchecked item', () => {
    expect(toggleTaskListItem('- [ ] Write tests', 0)).toEqual(
      '- [x] Write tests'
    )
  })

  it('unchecks a checked item, in either case', () => {
    expect(toggleTaskListItem('- [x] Done\n- [X] Also done', 1)).toEqual(
      '- [x] Done\n- [ ] Also done'
    )
  })

  it('counts items in document order across lists and nesting', () => {
    const markdown = [
      '## Plan',
      '',
      '* [ ] First',
      '  1. [ ] Nested',
      '',
      'Some text',
      '',
      '> - [ ] Quoted'
    ].join('\n')

    expect(toggleTaskListItem(markdown, 1)).toEqual(
      markdown.replace('1. [ ] Nested', '1. [x] Nested')
    )
    expect(toggleTaskListItem(markdown, 2)).toEqual(
      markdown.replace('> - [ ] Quoted', '> - [x] Quoted')
    )
  })

  it('skips plain list items and task syntax inside code', () => {
    const markdown = [
      '- Not a task',
      '',
      '```',
      '- [ ] In a code block',
      '```',
      '',
      '- [ ] Real task'
    ].join('\n')

    expect(toggleTaskListItem(markdown, 0)).toEqual(
      markdown.replace('- [ ] Real task', '- [x] Real task')
    )
  })

  it('keeps Windows line endings intact', () => {
    expect(toggleTaskListItem('- [ ] One\r\n- [ ] Two\r\n', 1)).toEqual(
      '- [ ] One\r\n- [x] Two\r\n'
    )
  })

  it('returns null for an index past the last item', () => {
    expect(toggleTaskListItem('- [ ] Only one', 1)).toEqual(null)
  })
})
