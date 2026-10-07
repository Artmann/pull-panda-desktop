import { useCallback, useState } from 'react'
import { toast } from 'sonner'

interface CopyPrompt {
  copy: () => void
  hasBeenClicked: boolean
}

/**
 * Copies the prompt from `buildPrompt` to the clipboard. `hasBeenClicked`
 * stays true for a moment after a successful copy so the button can confirm
 * it, and an error toast explains a failed copy.
 */
export function useCopyPrompt(buildPrompt: () => string): CopyPrompt {
  const [hasBeenClicked, setHasBeenClicked] = useState(false)

  const copy = useCallback(() => {
    const prompt = buildPrompt()

    setHasBeenClicked(true)

    navigator.clipboard
      .writeText(prompt)
      .then(() => {
        setTimeout(() => {
          setHasBeenClicked(false)
        }, 1_400)
      })
      .catch((error: unknown) => {
        console.error('Failed to copy prompt to clipboard:', error)
        setHasBeenClicked(false)
        toast.error('Failed to copy prompt to clipboard')
      })
  }, [buildPrompt])

  return { copy, hasBeenClicked }
}
