import fs from 'fs'
import path from 'path'

import { Octokit } from '@octokit/rest'

import { postReview } from './post-review'

const token = process.env.GITHUB_TOKEN

if (!token) {
  console.error('GITHUB_TOKEN is required.')
  process.exit(1)
}

const repository = process.env.GITHUB_REPOSITORY

if (!repository) {
  console.error('GITHUB_REPOSITORY is required.')
  process.exit(1)
}

const eventPath = process.env.GITHUB_EVENT_PATH

if (!eventPath) {
  console.error('GITHUB_EVENT_PATH is required.')
  process.exit(1)
}

const [owner, repo] = repository.split('/')
const event = JSON.parse(fs.readFileSync(eventPath, 'utf8'))
const prNumber = event.pull_request?.number
const commitSha = event.pull_request?.head?.sha

console.log(`PR context: ${owner}/${repo} #${prNumber}@${commitSha}`)

if (!prNumber || !commitSha) {
  console.error('Could not determine PR number or commit SHA from event payload.')
  process.exit(1)
}

const reviewPath = path.join(process.env.GITHUB_WORKSPACE ?? '.', 'review.json')
const octokit = new Octokit({ auth: token })

console.log(`Reading review file: ${reviewPath}`)

await postReview(octokit, { commitSha, owner, prNumber, repo, reviewPath })
