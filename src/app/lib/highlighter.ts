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

const warmLanguages = ['javascript', 'json', 'typescript']

export async function getSharedHighlighter(): Promise<Highlighter> {
  if (sharedHighlighter) {
    return sharedHighlighter
  }

  if (!highlighterPromise) {
    highlighterPromise = createHighlighter({
      langs: [],
      themes: allShikiThemeValues as unknown as BundledTheme[]
    })
      .then((highlighter) => {
        sharedHighlighter = highlighter

        return highlighter
      })
      .catch((error) => {
        // Drop the rejected promise so a later call can try again, instead of
        // latching the failure for the rest of the session.
        highlighterPromise = null

        throw error
      })
  }

  return highlighterPromise
}

// The synchronous view of the shared highlighter: `null` until it has finished
// loading. Callers use it to highlight before paint when everything is already
// warm, and fall back to the async path when it is not.
export function getLoadedHighlighter(): Highlighter | null {
  return sharedHighlighter
}

// The resolution rules `ensureLanguageLoaded` applies, without awaiting
// anything. Returns `null` when a grammar still has to be fetched, which tells
// the caller to take the async path for that block. Keeping both paths on this
// one function is what stops them from disagreeing about a language.
export function resolveLoadedLanguage(
  highlighter: Highlighter,
  language: string
): string | null {
  if (language === 'text' || language === 'plaintext') {
    return 'text'
  }

  if (highlighter.getLoadedLanguages().includes(language)) {
    return language
  }

  if (!(language in bundledLanguages)) {
    return 'text'
  }

  return null
}

// Lazily load a language grammar on demand and return the language id to use
// for highlighting. Falls back to 'text' when the language is unknown or fails
// to load. Concurrent requests for the same language share a single load.
export async function ensureLanguageLoaded(
  highlighter: Highlighter,
  language: string
): Promise<string> {
  const loadedLanguage = resolveLoadedLanguage(highlighter, language)

  if (loadedLanguage) {
    return loadedLanguage
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

// Load the highlighter and the grammars most code blocks use before anything
// asks for them, so the first highlighted block can render in the same frame as
// the markdown around it rather than a beat later.
export function warmHighlighter(): void {
  getSharedHighlighter()
    .then((highlighter) =>
      Promise.all(
        warmLanguages.map((language) =>
          ensureLanguageLoaded(highlighter, language)
        )
      )
    )
    .catch((error) => {
      console.error('Highlighter warm-up failed:', error)
    })
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
