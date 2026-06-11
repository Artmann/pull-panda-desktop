import { describe, expect, it } from 'vitest'

import { getLanguageFromPath } from './highlighter'

describe('getLanguageFromPath', () => {
  it.each([
    ['src/index.js', 'javascript'],
    ['src/App.jsx', 'javascript'],
    ['src/main.ts', 'typescript'],
    ['src/App.tsx', 'typescript'],
    ['script.py', 'python'],
    ['Main.java', 'java'],
    ['main.c', 'c'],
    ['main.cpp', 'c'],
    ['header.h', 'c'],
    ['header.hpp', 'c'],
    ['main.go', 'go'],
    ['app.rb', 'ruby'],
    ['index.php', 'php'],
    ['index.html', 'html'],
    ['index.htm', 'html'],
    ['styles.css', 'css'],
    ['styles.scss', 'css'],
    ['styles.sass', 'css'],
    ['query.gql', 'graphql'],
    ['query.graphql', 'graphql'],
    ['package.json', 'json'],
    ['README.md', 'markdown'],
    ['lib.rs', 'rust'],
    ['run.sh', 'bash'],
    ['run.bash', 'bash'],
    ['run.zsh', 'bash'],
    ['schema.sql', 'sql'],
    ['config.yaml', 'yaml'],
    ['config.yml', 'yaml']
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
