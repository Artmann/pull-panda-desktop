import type { EnhancedStore } from '@reduxjs/toolkit'
import { render } from '@testing-library/react'
import type { ReactElement } from 'react'
import { Provider } from 'react-redux'

import { ThemeProvider } from '@/app/lib/store/themeContext'

export function installObserverStubs() {
  class ObserverStub {
    disconnect() {
      // Stub
    }

    observe() {
      // Stub
    }

    unobserve() {
      // Stub
    }
  }

  global.IntersectionObserver =
    ObserverStub as unknown as typeof IntersectionObserver
  global.ResizeObserver = ObserverStub as unknown as typeof ResizeObserver
}

export function renderWithProviders(ui: ReactElement, store: EnhancedStore) {
  return render(
    <Provider store={store}>
      <ThemeProvider>{ui}</ThemeProvider>
    </Provider>
  )
}
