// @vitest-environment jsdom

import { render, screen, act } from '@testing-library/react'
import { describe, expect, it, beforeEach } from 'vitest'

import { ThemeProvider, useTheme } from './themeContext'

function TestComponent() {
  const { theme, resolvedTheme, setTheme, toggleTheme } = useTheme()

  return (
    <div>
      <div data-testid="theme">{theme}</div>
      <div data-testid="resolved-theme">{resolvedTheme}</div>
      <button
        data-testid="toggle-button"
        onClick={toggleTheme}
      >
        Toggle
      </button>
      <button
        data-testid="set-dark"
        onClick={() => setTheme('dark')}
      >
        Set Dark
      </button>
      <button
        data-testid="set-light"
        onClick={() => setTheme('light')}
      >
        Set Light
      </button>
      <button
        data-testid="set-system"
        onClick={() => setTheme('system')}
      >
        Set System
      </button>
    </div>
  )
}

describe('ThemeProvider', () => {
  beforeEach(() => {
    // Clear localStorage before each test
    localStorage.clear()
    // Remove dark class from document
    document.documentElement.classList.remove('dark')
  })

  it('defaults to system theme', () => {
    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    )

    expect(screen.getByTestId('theme')).toHaveTextContent('system')
  })

  it('applies dark class when theme is dark', () => {
    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    )

    const setDarkButton = screen.getByTestId('set-dark')

    act(() => {
      setDarkButton.click()
    })

    expect(document.documentElement.classList.contains('dark')).toBe(true)
    expect(screen.getByTestId('theme')).toHaveTextContent('dark')
    expect(screen.getByTestId('resolved-theme')).toHaveTextContent('dark')
  })

  it('removes dark class when theme is light', () => {
    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    )

    const setDarkButton = screen.getByTestId('set-dark')
    const setLightButton = screen.getByTestId('set-light')

    act(() => {
      setDarkButton.click()
    })

    expect(document.documentElement.classList.contains('dark')).toBe(true)

    act(() => {
      setLightButton.click()
    })

    expect(document.documentElement.classList.contains('dark')).toBe(false)
    expect(screen.getByTestId('theme')).toHaveTextContent('light')
    expect(screen.getByTestId('resolved-theme')).toHaveTextContent('light')
  })

  it('toggles between light and dark', () => {
    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    )

    const toggleButton = screen.getByTestId('toggle-button')
    const setLightButton = screen.getByTestId('set-light')

    act(() => {
      setLightButton.click()
    })

    expect(screen.getByTestId('theme')).toHaveTextContent('light')

    act(() => {
      toggleButton.click()
    })

    expect(screen.getByTestId('theme')).toHaveTextContent('dark')
    expect(document.documentElement.classList.contains('dark')).toBe(true)

    act(() => {
      toggleButton.click()
    })

    expect(screen.getByTestId('theme')).toHaveTextContent('light')
    expect(document.documentElement.classList.contains('dark')).toBe(false)
  })

  it('persists theme preference to localStorage', () => {
    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    )

    const setDarkButton = screen.getByTestId('set-dark')

    act(() => {
      setDarkButton.click()
    })

    expect(localStorage.getItem('pull-panda-theme')).toEqual('dark')
  })

  it('loads theme preference from localStorage', () => {
    localStorage.setItem('pull-panda-theme', 'dark')

    render(
      <ThemeProvider>
        <TestComponent />
      </ThemeProvider>
    )

    expect(screen.getByTestId('theme')).toHaveTextContent('dark')
  })
})
