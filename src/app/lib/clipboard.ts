import { toast } from 'sonner'

/** Copies `value` and confirms with `message`, or says why it could not. */
export function copyToClipboard(value: string, message: string): void {
  navigator.clipboard
    .writeText(value)
    .then(() => {
      toast.success(message)
    })
    .catch((error: unknown) => {
      console.error('Failed to copy to clipboard:', error)
      toast.error('Could not copy to the clipboard.')
    })
}
