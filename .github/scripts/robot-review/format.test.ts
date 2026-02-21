import { describe, expect, it } from 'vitest'

import {
  buildIssueCommentBody,
  buildSummaryBody,
  commentMarker,
  issueSlug,
  signature,
  summaryMarker,
} from './format'
import type { Issue } from './types'

describe('issueSlug', () => {
  it('generates a stable slug from file and title', () => {
    expect(issueSlug('src/app.ts', 'Missing null check')).toEqual(
      'src-app-ts-missing-null-check'
    )
  })

  it('handles special characters', () => {
    expect(issueSlug('src/utils/helper.tsx', 'Fix XSS & injection')).toEqual(
      'src-utils-helper-tsx-fix-xss-injection'
    )
  })

  it('collapses consecutive dashes', () => {
    expect(issueSlug('src/foo---bar.ts', 'test   title')).toEqual(
      'src-foo-bar-ts-test-title'
    )
  })
})

describe('buildSummaryBody', () => {
  it('returns "Looks good to me!" for empty issues', () => {
    const body = buildSummaryBody('All good', [])

    expect(body).toEqual(
      `${summaryMarker}\n\n${signature}\n\nLooks good to me! :rocket:`
    )
  })

  it('includes summary and bulleted issues', () => {
    const issues: Issue[] = [
      {
        description: 'Desc',
        file: 'src/app.ts',
        line: 10,
        severity: 'critical',
        title: 'Missing null check',
      },
      {
        description: 'Desc',
        file: 'src/utils.ts',
        line: 5,
        severity: 'minor',
        title: 'Unused import',
      },
    ]

    const body = buildSummaryBody('Found some issues.', issues)

    expect(body).toContain('## Robot Code Review')
    expect(body).toContain('Found some issues.')
    expect(body).toContain(
      '- 🔴 **Critical:** Missing null check — `src/app.ts:10`'
    )
    expect(body).toContain(
      '- 🟡 **Minor:** Unused import — `src/utils.ts:5`'
    )
  })

  it('uses correct emojis per severity', () => {
    const makeIssue = (severity: Issue['severity']): Issue => ({
      description: 'D',
      file: 'f.ts',
      line: 1,
      severity,
      title: 'T',
    })

    const body = buildSummaryBody('Summary', [
      makeIssue('critical'),
      makeIssue('major'),
      makeIssue('minor'),
    ])

    expect(body).toContain('🔴 **Critical:**')
    expect(body).toContain('🟠 **Major:**')
    expect(body).toContain('🟡 **Minor:**')
  })
})

describe('buildIssueCommentBody', () => {
  const issue: Issue = {
    description: 'This could cause a runtime error.',
    file: 'src/app.ts',
    line: 42,
    severity: 'major',
    title: 'Unchecked return value',
  }

  it('includes the comment marker', () => {
    const body = buildIssueCommentBody(issue)

    expect(body).toContain(commentMarker)
  })

  it('includes the issue marker with slug', () => {
    const body = buildIssueCommentBody(issue)

    expect(body).toContain('<!-- robot-issue: src-app-ts-unchecked-return-value -->')
  })

  it('includes the signature', () => {
    const body = buildIssueCommentBody(issue)

    expect(body).toContain(signature)
  })

  it('includes severity heading and description', () => {
    const body = buildIssueCommentBody(issue)

    expect(body).toContain('### 🟠 Major: Unchecked return value')
    expect(body).toContain('This could cause a runtime error.')
  })
})
