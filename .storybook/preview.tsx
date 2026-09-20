import type { Preview } from '@storybook/react-vite'
import { withThemeByClassName } from '@storybook/addon-themes'

import { TooltipProvider } from '@/app/components/ui/tooltip'

import '@/app/index.css'

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i
      }
    },
    backgrounds: { disable: true },
    options: {
      storySort: {
        order: ['Components', 'shadcn']
      }
    }
  },
  decorators: [
    // The app mounts one provider at its root; stories need the same one, or
    // every tooltip in them throws.
    (Story) => (
      <TooltipProvider>
        <Story />
      </TooltipProvider>
    ),
    withThemeByClassName({
      themes: {
        light: '',
        dark: 'dark'
      },
      defaultTheme: 'light'
    })
  ]
}

export default preview
