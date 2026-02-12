import { type BundledTheme, createHighlighter, type Highlighter } from 'shiki'

import { allCodeThemeValues } from './codeThemes'

let sharedHighlighter: Highlighter | null = null
let highlighterPromise: Promise<Highlighter> | null = null

const supportedLanguages = [
  'javascript',
  'typescript',
  'python',
  'java',
  'c',
  'go',
  'ruby',
  'php',
  'html',
  'css',
  'json',
  'markdown',
  'bash',
  'shell'
]

export async function getSharedHighlighter(): Promise<Highlighter> {
  if (sharedHighlighter) {
    return sharedHighlighter
  }

  if (!highlighterPromise) {
    highlighterPromise = createHighlighter({
      themes: allCodeThemeValues as unknown as BundledTheme[],
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
    case 'json':
      return 'json'
    case 'md':
      return 'markdown'
    case 'sh':
    case 'bash':
    case 'zsh':
      return 'bash'
    default:
      return
  }
}

export { supportedLanguages }
