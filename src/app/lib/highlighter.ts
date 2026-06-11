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

const languageByExtension: Record<string, string> = {
  bash: 'bash',
  c: 'c',
  cpp: 'c',
  css: 'css',
  go: 'go',
  gql: 'graphql',
  graphql: 'graphql',
  h: 'c',
  hpp: 'c',
  htm: 'html',
  html: 'html',
  java: 'java',
  js: 'javascript',
  json: 'json',
  jsx: 'javascript',
  md: 'markdown',
  php: 'php',
  py: 'python',
  rb: 'ruby',
  rs: 'rust',
  sass: 'css',
  scss: 'css',
  sh: 'bash',
  sql: 'sql',
  ts: 'typescript',
  tsx: 'typescript',
  yaml: 'yaml',
  yml: 'yaml',
  zsh: 'bash'
}

export function getLanguageFromPath(path?: string): string | undefined {
  if (!path) {
    return
  }

  const extension = path.split('.').pop()?.toLowerCase()

  if (!extension) {
    return
  }

  return languageByExtension[extension]
}
