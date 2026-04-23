import type { StorybookConfig } from '@storybook/react-vite'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import { fileURLToPath } from 'url'

const dirname = path.dirname(fileURLToPath(import.meta.url))

const config: StorybookConfig = {
  framework: { name: '@storybook/react-vite', options: {} },
  stories: [
    '../src/app/components/ui/**/*.stories.@(ts|tsx|mdx)',
    '../src/app/components/**/*.stories.@(ts|tsx|mdx)'
  ],
  addons: ['@storybook/addon-a11y', '@storybook/addon-themes'],
  viteFinal: async (config) => {
    config.plugins ??= []
    config.plugins.push(tailwindcss())
    config.resolve ??= {}
    config.resolve.alias = {
      ...(config.resolve.alias ?? {}),
      '@': path.resolve(dirname, '../src')
    }
    return config
  }
}

export default config
