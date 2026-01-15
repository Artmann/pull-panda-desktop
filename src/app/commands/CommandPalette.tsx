import { useState, useEffect, useCallback } from 'react'
import { useHotkeys } from 'react-hotkeys-hook'

// Store the open state setter for external access
let setCommandPaletteOpenExternal: ((open: boolean) => void) | null = null

export function openCommandPalette() {
  setCommandPaletteOpenExternal?.(true)
}

export function closeCommandPalette() {
  setCommandPaletteOpenExternal?.(false)
}

export function CommandPalette() {
  const [open, setOpen] = useState(false)

  const setOpenCallback = useCallback((value: boolean) => {
    setOpen(value)
  }, [])

  useEffect(() => {
    setCommandPaletteOpenExternal = setOpenCallback
    return () => {
      setCommandPaletteOpenExternal = null
    }
  }, [setOpenCallback])

  // Mod+K to toggle
  useHotkeys('mod+k', (event) => {
    event.preventDefault()
    setOpen((prev) => !prev)
  })

  // Escape to close
  useHotkeys(
    'escape',
    (event) => {
      event.preventDefault()
      setOpen(false)
    },
    { enabled: open }
  )

  if (!open) return null

  // Placeholder UI
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]">
      <div
        className="fixed inset-0 bg-black/50"
        onClick={() => setOpen(false)}
      />

      <div className="relative z-10 w-full max-w-lg rounded-lg border bg-background p-4 shadow-lg">
        <p className="text-sm text-muted-foreground">
          Command palette placeholder. Press Escape to close.
        </p>
      </div>
    </div>
  )
}
