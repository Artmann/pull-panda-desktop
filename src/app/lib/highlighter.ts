import {
  type BundledLanguage,
  type BundledTheme,
  bundledLanguages,
  createHighlighter,
  type Highlighter
} from 'shiki'

import { allShikiThemeValues } from './themes'

let sharedHighlighter: Highlighter | null = null
let highlighterPromise: Promise<Highlighter> | null = null

const languageLoadPromises = new Map<string, Promise<void>>()

export async function getSharedHighlighter(): Promise<Highlighter> {
  if (sharedHighlighter) {
    return sharedHighlighter
  }

  if (!highlighterPromise) {
    highlighterPromise = createHighlighter({
      themes: allShikiThemeValues as unknown as BundledTheme[],
      langs: []
    })

    sharedHighlighter = await highlighterPromise
  }

  return highlighterPromise
}

// Lazily load a language grammar on demand and return the language id to use
// for highlighting. Falls back to 'text' when the language is unknown or fails
// to load. Concurrent requests for the same language share a single load.
export async function ensureLanguageLoaded(
  highlighter: Highlighter,
  language: string
): Promise<string> {
  if (language === 'text' || language === 'plaintext') {
    return 'text'
  }

  if (highlighter.getLoadedLanguages().includes(language)) {
    return language
  }

  if (!(language in bundledLanguages)) {
    return 'text'
  }

  let loadPromise = languageLoadPromises.get(language)

  if (!loadPromise) {
    loadPromise = highlighter
      .loadLanguage(bundledLanguages[language as BundledLanguage])
      .catch((error) => {
        languageLoadPromises.delete(language)

        throw error
      })

    languageLoadPromises.set(language, loadPromise)
  }

  try {
    await loadPromise
  } catch {
    return 'text'
  }

  return language
}

const languageByExtension: Record<string, string> = {
  asm: 'asm',
  bash: 'bash',
  c: 'c',
  cc: 'cpp',
  clj: 'clojure',
  cljs: 'clojure',
  cmake: 'cmake',
  cpp: 'cpp',
  cs: 'csharp',
  csharp: 'csharp',
  css: 'css',
  cxx: 'cpp',
  dart: 'dart',
  diff: 'diff',
  elm: 'elm',
  erl: 'erlang',
  ex: 'elixir',
  exs: 'elixir',
  fs: 'fsharp',
  go: 'go',
  gql: 'graphql',
  gradle: 'groovy',
  graphql: 'graphql',
  groovy: 'groovy',
  h: 'c',
  hpp: 'cpp',
  hs: 'haskell',
  htm: 'html',
  html: 'html',
  ini: 'ini',
  java: 'java',
  jl: 'julia',
  js: 'javascript',
  json: 'json',
  jsonc: 'jsonc',
  jsx: 'javascript',
  kt: 'kotlin',
  kts: 'kotlin',
  less: 'less',
  lua: 'lua',
  md: 'markdown',
  ml: 'ocaml',
  nix: 'nix',
  patch: 'diff',
  php: 'php',
  pl: 'perl',
  pm: 'perl',
  proto: 'proto',
  ps1: 'powershell',
  py: 'python',
  r: 'r',
  rb: 'ruby',
  rs: 'rust',
  sass: 'sass',
  scala: 'scala',
  scss: 'scss',
  sh: 'bash',
  sol: 'solidity',
  sql: 'sql',
  svelte: 'svelte',
  swift: 'swift',
  tf: 'terraform',
  toml: 'toml',
  ts: 'typescript',
  tsx: 'typescript',
  vue: 'vue',
  xml: 'xml',
  yaml: 'yaml',
  yml: 'yaml',
  zig: 'zig',
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
