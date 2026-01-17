import type { LucideIcon } from 'lucide-react'

import type {
  Comment,
  ModifiedFile,
  PullRequestDetails
} from '@/types/pull-request-details'
import type { PullRequest } from '@/types/pull-request'

export type CommandView = 'home' | 'pr-detail' | 'other'

export type CommandGroup =
  | 'navigation'
  | 'view'
  | 'pull request'
  | 'app'

export type CommandContext = {
  view: CommandView
  pullRequest?: PullRequest
  pullRequestDetails?: PullRequestDetails
  selectedFile?: ModifiedFile
  selectedComment?: Comment
}

export type Shortcut = {
  key: string
  mod?: boolean
  shift?: boolean
  alt?: boolean
}

export type Command = {
  id: string
  label: string
  group: CommandGroup
  icon?: LucideIcon
  shortcut?: Shortcut
  isAvailable: (context: CommandContext) => boolean
  execute: (context: CommandContext) => void | Promise<void>
}
