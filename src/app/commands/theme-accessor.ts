type Setter = (value: string) => void

let currentResolvedMode: 'dark' | 'light' = 'dark'
let modeSetter: Setter | null = null
let themeSetter: Setter | null = null

export function getResolvedMode(): 'dark' | 'light' {
  return currentResolvedMode
}

export function setResolvedMode(mode: 'dark' | 'light'): void {
  currentResolvedMode = mode
}

export function setAppThemeSetter(
  kind: 'mode' | 'theme',
  setter: Setter
): void {
  if (kind === 'mode') {
    modeSetter = setter
  } else {
    themeSetter = setter
  }
}

export function getModeSetter(): Setter {
  if (!modeSetter) {
    throw new Error('Mode setter not initialized')
  }

  return modeSetter
}

export function getThemeSetter(): Setter {
  if (!themeSetter) {
    throw new Error('Theme setter not initialized')
  }

  return themeSetter
}
