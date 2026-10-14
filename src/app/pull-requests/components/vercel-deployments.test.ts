import { describe, expect, it } from 'vitest'

import { isVercelBot, parseVercelDeployments } from './vercel-deployments'

const vercelComment = [
  '[vc]: #abc123',
  'The latest updates on your projects. Learn more about [Vercel for GitHub](https://vercel.link/github-learn-more).',
  '',
  '| Project | Deployment | Actions | Updated (UTC) |',
  '| :--- | :----- | :------ | :------ |',
  '| [bitesized](https://vercel.com/artmann/bitesized) | ![Ready](https://vercel.com/static/status/ready.svg) [Ready](https://vercel.com/artmann/bitesized/abc) | [Preview](https://bitesized-git-qr.vercel.app), [Comment](https://vercel.live/open-feedback/x) | Oct 14, 2026 7:12am |',
  '',
  '<a href="https://vercel.com/agent">Review with Vercel Agent</a>'
].join('\n')

describe('parseVercelDeployments', () => {
  it('reads each project row from the deployment table', () => {
    expect(parseVercelDeployments(vercelComment)).toEqual([
      {
        previewUrl: 'https://bitesized-git-qr.vercel.app',
        project: 'bitesized',
        status: 'Ready',
        updated: 'Oct 14, 2026 7:12am'
      }
    ])
  })

  it('handles a project that is still building and has no preview yet', () => {
    const body = [
      '| Project | Deployment | Preview | Updated (UTC) |',
      '| :--- | :----- | :------ | :------ |',
      '| **docs** | 🔄 Building ([Inspect](https://vercel.com/x)) | | Oct 14, 2026 7:12am |'
    ].join('\n')

    expect(parseVercelDeployments(body)).toEqual([
      {
        previewUrl: null,
        project: 'docs',
        status: 'Building',
        updated: 'Oct 14, 2026 7:12am'
      }
    ])
  })

  it('returns nothing for a comment without a deployment table', () => {
    expect(parseVercelDeployments('Deployment failed with an error.')).toEqual(
      []
    )
    expect(parseVercelDeployments(null)).toEqual([])
  })
})

describe('isVercelBot', () => {
  it('recognises the Vercel bot logins', () => {
    expect([
      isVercelBot('vercel[bot]'),
      isVercelBot('vercel'),
      isVercelBot('octocat'),
      isVercelBot(null)
    ]).toEqual([true, true, false, false])
  })
})
