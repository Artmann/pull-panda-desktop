import { useTheme } from 'next-themes'
import { type ReactElement, type ReactNode, useEffect, useState } from 'react'

import { Card, CardContent } from '../components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '../components/ui/select'

import {
  darkCodeThemes,
  lightCodeThemes,
  type DarkCodeTheme,
  type LightCodeTheme
} from '@/app/lib/codeThemes'
import { getSharedHighlighter } from '@/app/lib/highlighter'
import { useCodeTheme } from '@/app/lib/store/codeThemeContext'

const sampleCode = `function greet(name: string): string {
  const message = \`Hello, \${name}!\`

  console.log(message)

  return message
}`

export function AppearanceSettings(): ReactElement {
  const { theme, setTheme } = useTheme()
  const { darkTheme, lightTheme, setDarkTheme, setLightTheme } = useCodeTheme()

  return (
    <div>
      <h2 className="text-xl font-medium mb-6">Appearance</h2>

      <Card className="pt-0">
        <CardContent>
          <SettingItem
            description="Select or customize your interface color scheme"
            label="Interface theme"
          >
            <Select
              value={theme}
              onValueChange={setTheme}
            >
              <SelectTrigger className="w-45">
                <SelectValue placeholder="Theme" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="dark">Dark</SelectItem>
                <SelectItem value="light">Light</SelectItem>
                <SelectItem value="system">System preference</SelectItem>
              </SelectContent>
            </Select>
          </SettingItem>

          <SettingItem
            description="Select the syntax highlighting style for code blocks and diffs in light mode"
            label="Code theme (light)"
          >
            <Select
              value={lightTheme}
              onValueChange={setLightTheme}
            >
              <SelectTrigger className="w-45">
                <SelectValue placeholder="Theme" />
              </SelectTrigger>
              <SelectContent>
                {lightCodeThemes.map((codeTheme) => (
                  <SelectItem
                    key={codeTheme.value}
                    value={codeTheme.value}
                  >
                    {codeTheme.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </SettingItem>

          <SettingItem
            description="Select the syntax highlighting style for code blocks and diffs in dark mode"
            label="Code theme (dark)"
          >
            <Select
              value={darkTheme}
              onValueChange={setDarkTheme}
            >
              <SelectTrigger className="w-45">
                <SelectValue placeholder="Theme" />
              </SelectTrigger>
              <SelectContent>
                {darkCodeThemes.map((codeTheme) => (
                  <SelectItem
                    key={codeTheme.value}
                    value={codeTheme.value}
                  >
                    {codeTheme.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </SettingItem>

          <div className="pt-6">
            <div className="font-medium mb-2">Preview</div>
            <CodePreview
              darkTheme={darkTheme}
              lightTheme={lightTheme}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function CodePreview({
  darkTheme,
  lightTheme
}: {
  darkTheme: DarkCodeTheme
  lightTheme: LightCodeTheme
}): ReactElement {
  const [highlightedHtml, setHighlightedHtml] = useState<string>('')

  useEffect(() => {
    async function highlight() {
      const highlighter = await getSharedHighlighter()

      const html = highlighter.codeToHtml(sampleCode, {
        lang: 'typescript',
        themes: {
          dark: darkTheme,
          light: lightTheme
        }
      })

      setHighlightedHtml(html)
    }

    void highlight()
  }, [darkTheme, lightTheme])

  if (!highlightedHtml) {
    return (
      <div className="rounded-lg bg-muted p-4 font-mono text-sm">
        Loading preview...
      </div>
    )
  }

  return (
    <div
      className="rounded-lg overflow-hidden text-sm [&_pre]:p-4 [&_pre]:m-0"
      dangerouslySetInnerHTML={{ __html: highlightedHtml }}
    />
  )
}

function SettingItem({
  children,
  description,
  label
}: {
  children: ReactNode
  description: string
  label: string
}): ReactElement {
  return (
    <div className="flex items-center justify-between py-6 border-b last:border-b-0 border-border">
      <div>
        <div className="font-medium">{label}</div>
        <div className="text-muted-foreground text-sm">{description}</div>
      </div>

      <div>{children}</div>
    </div>
  )
}
