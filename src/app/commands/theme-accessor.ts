type ThemeSetter = (theme: string) => void

let themeSetter: ThemeSetter | null = null

export function setThemeSetter(setter: ThemeSetter): void {
  themeSetter = setter
}

export function getThemeSetter(): ThemeSetter {
  if (!themeSetter) {
    throw new Error('Theme setter not initialized')
  }

  return themeSetter
}
