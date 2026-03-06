import { type BundledTheme, createHighlighter, type Highlighter } from 'shiki'

import { allShikiThemeValues } from './themes'

let sharedHighlighter: Highlighter | null = null
let highlighterPromise: Promise<Highlighter> | null = null

const supportedLanguages = [
  'bash',
  'c',
  'css',
  'go',
  'graphql',
  'html',
  'java',
  'javascript',
  'json',
  'markdown',
  'php',
  'python',
  'ruby',
  'rust',
  'shell',
  'sql',
  'typescript',
  'yaml'
]

export async function getSharedHighlighter(): Promise<Highlighter> {
  if (sharedHighlighter) {
    return sharedHighlighter
  }

  if (!highlighterPromise) {
    highlighterPromise = createHighlighter({
      themes: allShikiThemeValues as unknown as BundledTheme[],
      langs: supportedLanguages
    })

    sharedHighlighter = await highlighterPromise
  }

  return highlighterPromise
}

export function getLanguageFromPath(path?: string): string | undefined {
  if (!path) {
    return undefined
  }

  const extension = path.split('.').pop()?.toLowerCase()

  switch (extension) {
    case 'js':
    case 'jsx':
      return 'javascript'
    case 'ts':
    case 'tsx':
      return 'typescript'
    case 'py':
      return 'python'
    case 'java':
      return 'java'
    case 'c':
    case 'cpp':
    case 'h':
    case 'hpp':
      return 'c'
    case 'go':
      return 'go'
    case 'rb':
      return 'ruby'
    case 'php':
      return 'php'
    case 'html':
    case 'htm':
      return 'html'
    case 'css':
    case 'scss':
    case 'sass':
      return 'css'
    case 'gql':
    case 'graphql':
      return 'graphql'
    case 'json':
      return 'json'
    case 'md':
      return 'markdown'
    case 'rs':
      return 'rust'
    case 'sh':
    case 'bash':
    case 'zsh':
      return 'bash'
    case 'sql':
      return 'sql'
    case 'yaml':
    case 'yml':
      return 'yaml'
    default:
      return
  }
}

export { supportedLanguages }
