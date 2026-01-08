import { describe, it, expect } from 'vitest'

import type { Comment } from '@/types/pullRequestDetails'

import { findIssuesInTheDescriptionOrInTheComments } from './issue-finder'

function createMockComment(body: string | null): Comment {
  return {
    id: 'comment-1',
    gitHubId: 'gh-comment-1',
    gitHubNumericId: null,
    pullRequestId: 'pr-1',
    reviewId: null,
    body,
    bodyHtml: null,
    path: null,
    line: null,
    originalLine: null,
    diffHunk: null,
    commitId: null,
    originalCommitId: null,
    gitHubReviewId: null,
    gitHubReviewThreadId: null,
    parentCommentGitHubId: null,
    userLogin: 'testuser',
    userAvatarUrl: null,
    url: null,
    gitHubCreatedAt: null,
    gitHubUpdatedAt: null,
    syncedAt: new Date().toISOString()
  }
}

describe('findIssuesInTheDescriptionOrInTheComments', () => {
  describe('GitHub issue hashtags', () => {
    it('should find GitHub issue hashtags in description', () => {
      const result = findIssuesInTheDescriptionOrInTheComments(
        'owner',
        'repo',
        'This fixes #123',
        []
      )

      expect(result).toEqual([
        {
          source: 'github',
          url: 'https://github.com/owner/repo/issues/123',
          title: 'Issue #123'
        }
      ])
    })

    it('should find multiple issue hashtags', () => {
      const result = findIssuesInTheDescriptionOrInTheComments(
        'owner',
        'repo',
        'Closes #123 and relates to #456',
        []
      )

      expect(result).toHaveLength(2)
      expect(result.map((r) => r.url)).toContain(
        'https://github.com/owner/repo/issues/123'
      )
      expect(result.map((r) => r.url)).toContain(
        'https://github.com/owner/repo/issues/456'
      )
    })

    it('should find issue hashtags in comments', () => {
      const comments = [createMockComment('See issue #789')]

      const result = findIssuesInTheDescriptionOrInTheComments(
        'owner',
        'repo',
        null,
        comments
      )

      expect(result).toEqual([
        {
          source: 'github',
          url: 'https://github.com/owner/repo/issues/789',
          title: 'Issue #789'
        }
      ])
    })
  })

  describe('GitHub issue URLs', () => {
    it('should find GitHub issue URLs', () => {
      const result = findIssuesInTheDescriptionOrInTheComments(
        'owner',
        'repo',
        'Related: https://github.com/other/project/issues/42',
        []
      )

      expect(result).toContainEqual({
        source: 'github',
        url: 'https://github.com/other/project/issues/42'
      })
    })

    it('should find GitHub issue URLs in markdown links', () => {
      const result = findIssuesInTheDescriptionOrInTheComments(
        'owner',
        'repo',
        '[Bug fix](https://github.com/owner/repo/issues/100)',
        []
      )

      const githubIssues = result.filter((r) => r.source === 'github')
      expect(githubIssues.length).toBeGreaterThanOrEqual(1)
    })
  })

  describe('Linear issues', () => {
    it('should find Linear URLs', () => {
      const result = findIssuesInTheDescriptionOrInTheComments(
        'owner',
        'repo',
        'Implements https://linear.app/team/issue/ABC-123/feature-title',
        []
      )

      const linearIssues = result.filter((r) => r.source === 'linear')
      expect(linearIssues).toHaveLength(1)
      expect(linearIssues[0].url).toEqual(
        'https://linear.app/team/issue/abc-123/feature-title'
      )
    })

    it('should find Linear markdown links with title', () => {
      const result = findIssuesInTheDescriptionOrInTheComments(
        'owner',
        'repo',
        '[Feature Request](https://linear.app/team/issue/ABC-123/feature-title)',
        []
      )

      const linearIssues = result.filter((r) => r.source === 'linear')
      expect(linearIssues.length).toBeGreaterThanOrEqual(1)
      expect(linearIssues.some((l) => l.title === 'Feature Request')).toBe(true)
    })
  })

  describe('Jira issues', () => {
    it('should find Jira URLs', () => {
      const result = findIssuesInTheDescriptionOrInTheComments(
        'owner',
        'repo',
        '[PROJ-123](https://company.atlassian.net/jira/browse/PROJ-123)',
        []
      )

      const jiraIssues = result.filter((r) => r.source === 'jira')
      expect(jiraIssues).toHaveLength(1)
      expect(jiraIssues[0].title).toEqual('PROJ-123')
    })
  })

  describe('deduplication', () => {
    it('should deduplicate issues by URL', () => {
      const result = findIssuesInTheDescriptionOrInTheComments(
        'owner',
        'repo',
        'Fixes #123. See #123 for details.',
        []
      )

      const urls = result.map((r) => r.url)
      const uniqueUrls = [...new Set(urls)]
      expect(urls).toEqual(uniqueUrls)
    })

    it('should preserve title from first occurrence', () => {
      const result = findIssuesInTheDescriptionOrInTheComments(
        'owner',
        'repo',
        '[My Title](https://linear.app/team/issue/ABC-123/slug) and https://linear.app/team/issue/ABC-123/slug',
        []
      )

      const linearIssues = result.filter((r) => r.source === 'linear')
      expect(linearIssues).toHaveLength(1)
      expect(linearIssues[0].title).toEqual('My Title')
    })
  })

  describe('edge cases', () => {
    it('should handle null body', () => {
      const result = findIssuesInTheDescriptionOrInTheComments(
        'owner',
        'repo',
        null,
        []
      )

      expect(result).toEqual([])
    })

    it('should handle empty comments array', () => {
      const result = findIssuesInTheDescriptionOrInTheComments(
        'owner',
        'repo',
        'Fixes #1',
        []
      )

      expect(result).toHaveLength(1)
    })

    it('should handle comments with null bodies', () => {
      const comments = [createMockComment(null)]

      const result = findIssuesInTheDescriptionOrInTheComments(
        'owner',
        'repo',
        null,
        comments
      )

      expect(result).toEqual([])
    })

    it('should handle non-array comments gracefully', () => {
      const result = findIssuesInTheDescriptionOrInTheComments(
        'owner',
        'repo',
        'Fixes #1',
        null as unknown as Comment[]
      )

      expect(result).toHaveLength(1)
    })

    it('should handle text without any issues', () => {
      const result = findIssuesInTheDescriptionOrInTheComments(
        'owner',
        'repo',
        'This is just a regular description without any links.',
        []
      )

      expect(result).toEqual([])
    })

    it('should normalize URLs to lowercase', () => {
      const result = findIssuesInTheDescriptionOrInTheComments(
        'owner',
        'repo',
        '[Link](https://GitHub.com/Owner/Repo/Issues/123)',
        []
      )

      const urls = result.map((r) => r.url)
      expect(urls.every((url) => url === url.toLowerCase())).toBe(true)
    })
  })

  describe('combined sources', () => {
    it('should find issues from multiple sources', () => {
      const body = `
This PR:
- Fixes #42
- Implements [LINEAR-123](https://linear.app/team/issue/LIN-123/title)
- Related to [JIRA-456](https://company.atlassian.net/jira/browse/JIRA-456)
      `

      const result = findIssuesInTheDescriptionOrInTheComments(
        'owner',
        'repo',
        body,
        []
      )

      const sources = result.map((r) => r.source)
      expect(sources).toContain('github')
      expect(sources).toContain('linear')
      expect(sources).toContain('jira')
    })

    it('should combine issues from body and comments', () => {
      const body = 'Fixes #1'
      const comments = [createMockComment('Also see #2')]

      const result = findIssuesInTheDescriptionOrInTheComments(
        'owner',
        'repo',
        body,
        comments
      )

      expect(result).toHaveLength(2)
    })
  })
})
