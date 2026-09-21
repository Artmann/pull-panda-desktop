import { useTheme } from 'next-themes'
import { type ReactElement, useEffect, useState } from 'react'

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/app/components/ui/select'
import {
  ensureLanguageLoaded,
  getSharedHighlighter
} from '@/app/lib/highlighter'
import { useAppTheme } from '@/app/lib/store/themeContext'
import { getThemesForMode, type AppTheme } from '@/app/lib/themes'
import { useDiffLayout } from '@/app/pull-requests/diffs/use-diff-layout'

import { SettingRow, SettingsSection } from './section'

const sampleCode = `function greet(name: string): string {
  const message = \`Hello, \${name}!\`

  console.log(message)

  return message
}`

export function AppearanceSettings(): ReactElement {
  const { resolvedTheme, theme, setTheme } = useTheme()
  const { appTheme, setAppTheme } = useAppTheme()
  const [diffLayout, setDiffLayout] = useDiffLayout()
  const mode = resolvedTheme === 'dark' ? 'dark' : 'light'
  const availableThemes = getThemesForMode(mode)

  return (
    <SettingsSection title="Appearance">
      <SettingRow
        description="Colors for the whole application."
        label="Theme"
      >
        <Select
          value={appTheme.value}
          onValueChange={setAppTheme}
        >
          <SelectTrigger
            className="w-44"
            size="sm"
          >
            <SelectValue placeholder="Theme" />
          </SelectTrigger>
          <SelectContent>
            {availableThemes.map((availableTheme) => (
              <SelectItem
                key={availableTheme.value}
                value={availableTheme.value}
              >
                {availableTheme.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </SettingRow>

      <SettingRow
        description="Light, dark, or follow your system."
        label="Appearance"
      >
        <Select
          value={theme}
          onValueChange={setTheme}
        >
          <SelectTrigger
            className="w-44"
            size="sm"
          >
            <SelectValue placeholder="Appearance" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="dark">Dark</SelectItem>
            <SelectItem value="light">Light</SelectItem>
            <SelectItem value="system">System preference</SelectItem>
          </SelectContent>
        </Select>
      </SettingRow>

      <SettingRow
        description="The default for file diffs. Each file has a toggle to override it."
        label="Diff layout"
      >
        <Select
          value={diffLayout}
          onValueChange={(value) => {
            setDiffLayout(value === 'split' ? 'split' : 'unified')
          }}
        >
          <SelectTrigger
            className="w-44"
            size="sm"
          >
            <SelectValue placeholder="Diff layout" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="unified">Unified</SelectItem>
            <SelectItem value="split">Split</SelectItem>
          </SelectContent>
        </Select>
      </SettingRow>

      <div className="flex flex-col gap-2 py-3">
        <div className="text-xs text-muted-foreground">Preview</div>

        <CodePreview appTheme={appTheme} />
      </div>
    </SettingsSection>
  )
}

function CodePreview({ appTheme }: { appTheme: AppTheme }): ReactElement {
  const [highlightedHtml, setHighlightedHtml] = useState<string>('')

  useEffect(() => {
    async function highlight() {
      const highlighter = await getSharedHighlighter()
      const language = await ensureLanguageLoaded(highlighter, 'typescript')

      const html = highlighter.codeToHtml(sampleCode, {
        lang: language,
        themes: {
          dark: appTheme.darkShikiTheme,
          light: appTheme.lightShikiTheme
        }
      })

      setHighlightedHtml(html)
    }

    void highlight()
  }, [appTheme.darkShikiTheme, appTheme.lightShikiTheme])

  if (!highlightedHtml) {
    return (
      <div className="rounded-md border border-border bg-muted p-3 font-mono text-xs text-muted-foreground">
        Loading preview…
      </div>
    )
  }

  return (
    <div
      className="overflow-hidden rounded-md border border-border text-xs [&_pre]:m-0 [&_pre]:overflow-x-auto [&_pre]:p-3"
      dangerouslySetInnerHTML={{ __html: highlightedHtml }}
    />
  )
}
