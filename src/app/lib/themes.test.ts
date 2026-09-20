import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { themeVariableMap } from './applyThemePalette'
import {
  defaultDarkThemeValue,
  defaultLightThemeValue,
  getThemeByValue,
  type ThemePalette
} from './themes'

const appDirectory = path.join(__dirname, '..')
const stylesheet = readFileSync(path.join(appDirectory, 'index.css'), 'utf8')

/**
 * The custom properties declared by one selector in index.css.
 *
 * `applyThemePalette` writes every palette field as an inline style on the
 * document element, and inline styles outrank both `:root` and `.dark`. So the
 * stylesheet only drives first paint and Storybook, while the running app is
 * driven entirely by the palettes in themes.ts. Two hand-maintained copies of
 * the same colours is exactly the shape that drifts, and neither surface
 * validates the other — hence this test.
 */
function readDeclarations(selector: string): Map<string, string> {
  const start = stylesheet.indexOf(`${selector} {`)

  if (start === -1) {
    throw new Error(`index.css has no ${selector} block.`)
  }

  const block = stylesheet.slice(start, stylesheet.indexOf('\n}', start))

  return new Map(
    [...block.matchAll(/^\s*(--[a-z0-9-]+):\s*([^;]+);/gm)].map(
      ([, name, value]) => [name, value.trim()]
    )
  )
}

function readPalette(selector: string): ThemePalette {
  const declarations = readDeclarations(selector)
  const entries = Object.entries(themeVariableMap).map(
    ([field, cssVariable]) => [field, declarations.get(cssVariable)]
  )

  return Object.fromEntries(entries) as ThemePalette
}

function componentFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const entryPath = path.join(directory, entry.name)

    if (entry.isDirectory()) {
      return componentFiles(entryPath)
    }

    return entry.name.endsWith('.tsx') ? [entryPath] : []
  })
}

describe('the signature palettes', () => {
  // Going through the public API pins the defaults as well, so renaming a
  // default theme cannot route around the two comparisons below.
  const light = getThemeByValue(defaultLightThemeValue)
  const dark = getThemeByValue(defaultDarkThemeValue)

  it('are the ones the app starts in', () => {
    expect([light.label, dark.label]).toEqual(['Paper Panda', 'Midnight Panda'])
  })

  it('matches the :root block in index.css', () => {
    expect(light.light).toEqual(readPalette(':root'))
  })

  it('matches the .dark block in index.css', () => {
    expect(dark.dark).toEqual(readPalette('.dark'))
  })

  it('has a custom property in index.css for every palette field', () => {
    const root = readDeclarations(':root')
    const darkBlock = readDeclarations('.dark')
    const orphans = Object.entries(themeVariableMap)
      .filter(
        ([, cssVariable]) =>
          !root.has(cssVariable) && !darkBlock.has(cssVariable)
      )
      .map(([field]) => field)

    expect(orphans).toEqual([])
  })
})

describe('the type scale', () => {
  it('has no arbitrary font sizes left in src/app', () => {
    const offenders = componentFiles(appDirectory).filter((file) =>
      /text-\[\d+px\]/.test(readFileSync(file, 'utf8'))
    )

    // Every tier belongs to a named step in index.css, so `text-[13px]` has
    // nowhere to live. Add a token instead of an arbitrary value.
    expect(offenders.map((file) => path.relative(appDirectory, file))).toEqual(
      []
    )
  })
})
