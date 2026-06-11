/**
 * @vitest-environment jsdom
 */
import { beforeEach, describe, expect, it } from 'vitest'

import {
  darkStorageKey,
  lightStorageKey,
  migrateFromLegacyKeys
} from './themeMigration'

function storageSnapshot(): Record<string, string> {
  const snapshot: Record<string, string> = {}

  for (let index = 0; index < localStorage.length; index++) {
    const key = localStorage.key(index)

    if (key !== null) {
      snapshot[key] = localStorage.getItem(key) ?? ''
    }
  }

  return snapshot
}

describe('migrateFromLegacyKeys', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('does nothing when no legacy keys are present', () => {
    migrateFromLegacyKeys()

    expect(storageSnapshot()).toEqual({})
  })

  it('leaves already-migrated keys untouched', () => {
    localStorage.setItem(darkStorageKey, 'github')
    localStorage.setItem(lightStorageKey, 'solarized')

    migrateFromLegacyKeys()

    expect(storageSnapshot()).toEqual({
      [darkStorageKey]: 'github',
      [lightStorageKey]: 'solarized'
    })
  })

  describe('single app-theme key', () => {
    it('copies a both-modes theme to the dark and light keys', () => {
      localStorage.setItem('app-theme', 'github')

      migrateFromLegacyKeys()

      expect(storageSnapshot()).toEqual({
        [darkStorageKey]: 'github',
        [lightStorageKey]: 'github'
      })
    })

    it('copies a dark-only theme to the dark key only', () => {
      localStorage.setItem('app-theme', 'dracula')

      migrateFromLegacyKeys()

      expect(storageSnapshot()).toEqual({
        [darkStorageKey]: 'dracula'
      })
    })

    it('copies a light-only theme to the light key only', () => {
      localStorage.setItem('app-theme', 'paper-panda')

      migrateFromLegacyKeys()

      expect(storageSnapshot()).toEqual({
        [lightStorageKey]: 'paper-panda'
      })
    })

    it('treats an unknown theme value as a both-modes theme', () => {
      localStorage.setItem('app-theme', 'no-such-theme')

      migrateFromLegacyKeys()

      expect(storageSnapshot()).toEqual({
        [darkStorageKey]: 'no-such-theme',
        [lightStorageKey]: 'no-such-theme'
      })
    })
  })

  describe('combined catppuccin value', () => {
    it('splits a stored "catppuccin" value into mocha and latte', () => {
      localStorage.setItem(darkStorageKey, 'catppuccin')
      localStorage.setItem(lightStorageKey, 'catppuccin')

      migrateFromLegacyKeys()

      expect(storageSnapshot()).toEqual({
        [darkStorageKey]: 'catppuccin-mocha',
        [lightStorageKey]: 'catppuccin-latte'
      })
    })

    it('splits a legacy single "catppuccin" app-theme into both variants', () => {
      localStorage.setItem('app-theme', 'catppuccin')

      migrateFromLegacyKeys()

      expect(storageSnapshot()).toEqual({
        [darkStorageKey]: 'catppuccin-mocha',
        [lightStorageKey]: 'catppuccin-latte'
      })
    })
  })

  describe('per-mode code-theme keys', () => {
    it('maps a known shiki theme to its app theme for both keys', () => {
      localStorage.setItem('code-theme-dark', 'github-dark')

      migrateFromLegacyKeys()

      expect(storageSnapshot()).toEqual({
        [darkStorageKey]: 'github',
        [lightStorageKey]: 'github'
      })
    })

    it('falls back to the light code theme when no dark one is stored', () => {
      localStorage.setItem('code-theme-light', 'github-light')

      migrateFromLegacyKeys()

      expect(storageSnapshot()).toEqual({
        [darkStorageKey]: 'github',
        [lightStorageKey]: 'github'
      })
    })

    it('does not overwrite already-set theme keys', () => {
      localStorage.setItem(darkStorageKey, 'monokai')
      localStorage.setItem('code-theme-dark', 'github-dark')

      migrateFromLegacyKeys()

      expect(storageSnapshot()).toEqual({
        [darkStorageKey]: 'monokai',
        [lightStorageKey]: 'github'
      })
    })

    it('removes the legacy keys even when the value matches no theme', () => {
      localStorage.setItem('code-theme-dark', 'no-such-shiki-theme')
      localStorage.setItem('code-theme-light', 'also-unknown')

      migrateFromLegacyKeys()

      expect(storageSnapshot()).toEqual({})
    })
  })
})
