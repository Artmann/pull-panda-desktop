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

import { getSharedHighlighter } from '@/app/lib/highlighter'
import { useAppTheme } from '@/app/lib/store/themeContext'
import { appThemes, type AppTheme } from '@/app/lib/themes'

const sampleCode = `function greet(name: string): string {
  const message = \`Hello, \${name}!\`

  console.log(message)

  return message
}`

export function AppearanceSettings(): ReactElement {
  const { theme, setTheme } = useTheme()
  const { appTheme, setAppTheme } = useAppTheme()

  return (
    <div>
      <h2 className="text-xl font-medium mb-6">Appearance</h2>

      <Card className="pt-0">
        <CardContent>
          <SettingItem
            description="Choose the color theme for the entire application"
            label="Theme"
          >
            <Select
              value={appTheme.value}
              onValueChange={setAppTheme}
            >
              <SelectTrigger className="w-52">
                <SelectValue placeholder="Theme" />
              </SelectTrigger>
              <SelectContent>
                {appThemes.map((t) => (
                  <SelectItem
                    key={t.value}
                    value={t.value}
                  >
                    {t.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </SettingItem>

          <SettingItem
            description="Select light, dark, or follow your system preference"
            label="Appearance"
          >
            <Select
              value={theme}
              onValueChange={setTheme}
            >
              <SelectTrigger className="w-52">
                <SelectValue placeholder="Appearance" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="dark">Dark</SelectItem>
                <SelectItem value="light">Light</SelectItem>
                <SelectItem value="system">System preference</SelectItem>
              </SelectContent>
            </Select>
          </SettingItem>

          <div className="pt-6">
            <div className="font-medium mb-2">Preview</div>
            <CodePreview appTheme={appTheme} />
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

function CodePreview({
  appTheme
}: {
  appTheme: AppTheme
}): ReactElement {
  const [highlightedHtml, setHighlightedHtml] = useState<string>('')

  useEffect(() => {
    async function highlight() {
      const highlighter = await getSharedHighlighter()

      const html = highlighter.codeToHtml(sampleCode, {
        lang: 'typescript',
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
