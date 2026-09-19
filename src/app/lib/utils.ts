import { type ClassValue, clsx } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

// Custom font-size steps defined in index.css as `--text-*` theme tokens.
// tailwind-merge cannot see the theme, so without this it reads `text-2xs` as
// a *colour* utility and silently drops it when a class list also sets a text
// colour — the class never reaches the DOM and the element inherits its size.
const fontSizes = ['2xs']

const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      'font-size': [{ text: fontSizes }]
    }
  }
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
