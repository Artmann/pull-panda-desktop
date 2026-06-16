import { describe, expect, it } from 'vitest'

import {
  ensureLanguageLoaded,
  getLanguageFromPath,
  getSharedHighlighter
} from './highlighter'

describe('getLanguageFromPath', () => {
  it.each([
    ['src/index.js', 'javascript'],
    ['src/App.jsx', 'javascript'],
    ['src/main.ts', 'typescript'],
    ['src/App.tsx', 'typescript'],
    ['script.py', 'python'],
    ['Main.java', 'java'],
    ['main.c', 'c'],
    ['main.cpp', 'cpp'],
    ['main.cc', 'cpp'],
    ['main.cxx', 'cpp'],
    ['Program.cs', 'csharp'],
    ['header.h', 'c'],
    ['header.hpp', 'cpp'],
    ['main.go', 'go'],
    ['app.rb', 'ruby'],
    ['index.php', 'php'],
    ['index.html', 'html'],
    ['index.htm', 'html'],
    ['styles.css', 'css'],
    ['styles.scss', 'scss'],
    ['styles.sass', 'sass'],
    ['styles.less', 'less'],
    ['query.gql', 'graphql'],
    ['query.graphql', 'graphql'],
    ['package.json', 'json'],
    ['tsconfig.jsonc', 'jsonc'],
    ['README.md', 'markdown'],
    ['lib.rs', 'rust'],
    ['run.sh', 'bash'],
    ['run.bash', 'bash'],
    ['run.zsh', 'bash'],
    ['schema.sql', 'sql'],
    ['config.yaml', 'yaml'],
    ['config.yml', 'yaml'],
    ['Main.kt', 'kotlin'],
    ['App.swift', 'swift'],
    ['main.dart', 'dart'],
    ['Build.scala', 'scala'],
    ['script.lua', 'lua'],
    ['script.pl', 'perl'],
    ['analysis.r', 'r'],
    ['Main.hs', 'haskell'],
    ['app.ex', 'elixir'],
    ['module.erl', 'erlang'],
    ['core.clj', 'clojure'],
    ['deploy.ps1', 'powershell'],
    ['Cargo.toml', 'toml'],
    ['settings.ini', 'ini'],
    ['data.xml', 'xml'],
    ['App.vue', 'vue'],
    ['App.svelte', 'svelte'],
    ['changes.diff', 'diff'],
    ['changes.patch', 'diff'],
    ['service.proto', 'proto'],
    ['main.tf', 'terraform'],
    ['build.gradle', 'groovy'],
    ['Main.zig', 'zig'],
    ['Contract.sol', 'solidity']
  ])('maps %s to %s', (path, language) => {
    expect(getLanguageFromPath(path)).toEqual(language)
  })

  it('is case insensitive for the extension', () => {
    expect(getLanguageFromPath('src/Main.TS')).toEqual('typescript')
  })

  it('uses the last extension of a compound filename', () => {
    expect(getLanguageFromPath('component.test.tsx')).toEqual('typescript')
  })

  it('returns undefined for an unknown extension', () => {
    expect(getLanguageFromPath('binary.exe')).toEqual(undefined)
  })

  it('returns undefined for a file without an extension', () => {
    expect(getLanguageFromPath('Dockerfile')).toEqual(undefined)
  })

  it('returns undefined for a trailing dot', () => {
    expect(getLanguageFromPath('file.')).toEqual(undefined)
  })

  it('returns undefined for an empty path', () => {
    expect(getLanguageFromPath('')).toEqual(undefined)
  })

  it('returns undefined when no path is given', () => {
    expect(getLanguageFromPath()).toEqual(undefined)
  })
})

describe('ensureLanguageLoaded', () => {
  it('loads a bundled language on demand', async () => {
    const highlighter = await getSharedHighlighter()

    const language = await ensureLanguageLoaded(highlighter, 'csharp')

    expect(language).toEqual('csharp')
    expect(highlighter.getLoadedLanguages()).toContain('csharp')
  })

  it('falls back to text for an unknown language', async () => {
    const highlighter = await getSharedHighlighter()

    const language = await ensureLanguageLoaded(highlighter, 'not-a-language')

    expect(language).toEqual('text')
  })
})
