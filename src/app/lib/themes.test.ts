import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'

import { describe, expect, it } from 'vitest'

import { themeVariableMap } from './applyThemePalette'
import {
  appThemes,
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

/**
 * The linear sRGB channels a palette colour resolves to, or undefined when the
 * value is not the `oklch(L C H)` form every palette uses. Channels outside
 * 0..1 are outside the gamut a screen can show.
 */
function toLinearSrgb(color: string): number[] | undefined {
  const match = color.match(/^oklch\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)\s*\)$/)

  if (!match) {
    return
  }

  const lightness = Number(match[1])
  const chroma = Number(match[2])
  const hue = (Number(match[3]) * Math.PI) / 180

  const a = chroma * Math.cos(hue)
  const b = chroma * Math.sin(hue)

  const long = (lightness + 0.3963377774 * a + 0.2158037573 * b) ** 3
  const medium = (lightness - 0.1055613458 * a - 0.0638541728 * b) ** 3
  const short = (lightness - 0.0894841775 * a - 1.291485548 * b) ** 3

  return [
    4.0767416621 * long - 3.3077115913 * medium + 0.2309699292 * short,
    -1.2684380046 * long + 2.6097574011 * medium - 0.3413193965 * short,
    -0.0041960863 * long - 0.7034186147 * medium + 1.707614701 * short
  ]
}

function isOutsideSrgb(color: string): boolean {
  const channels = toLinearSrgb(color)

  if (channels === undefined) {
    return false
  }

  // A hair of tolerance: a colour sitting exactly on the boundary rounds to the
  // same byte either way, so only a real overshoot counts.
  return channels.some((channel) => channel < -0.0005 || channel > 1.0005)
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

describe('every palette', () => {
  it('stays inside the sRGB gamut', () => {
    const offenders = appThemes.flatMap((theme) =>
      (['dark', 'light'] as const).flatMap((mode) =>
        Object.entries(theme[mode])
          .filter(([, color]) => isOutsideSrgb(color))
          .map(([field, color]) => `${theme.value} ${mode} ${field}: ${color}`)
      )
    )

    // A colour outside sRGB is gamut-mapped by the browser, which shifts hue
    // and lightness by an amount the token never asked for — so what renders
    // is not what the palette says. Lower the chroma until the colour fits;
    // lightness and hue carry the intent, chroma is the part that cannot be
    // honoured anyway.
    expect(offenders).toEqual([])
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
