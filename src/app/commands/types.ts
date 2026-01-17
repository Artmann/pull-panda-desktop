import type { LucideIcon } from 'lucide-react'

import type {
  Comment,
  ModifiedFile,
  PullRequestDetails
} from '@/types/pull-request-details'
import type { PullRequest } from '@/types/pull-request'

export type CommandView = 'home' | 'pr-detail' | 'other'

export type CommandGroup = 'navigation' | 'view' | 'pull request' | 'app'

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

export type CommandOption<T = unknown> = {
  id: string
  label: string
  description?: string
  icon?: LucideIcon
  value: T
}

export type CommandParam<T = unknown> = {
  type: 'select'
  placeholder?: string
  getOptions: (context: CommandContext, query: string) => CommandOption<T>[]
}

export type Command<T = unknown> = {
  id: string
  label: string
  group: CommandGroup
  icon?: LucideIcon
  shortcut?: Shortcut
  param?: CommandParam<T>
  isAvailable: (context: CommandContext) => boolean
  execute: (context: CommandContext, value?: T) => void | Promise<void>
}
