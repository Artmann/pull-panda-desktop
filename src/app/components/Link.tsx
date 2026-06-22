import type { MouseEvent, ReactElement } from 'react'

import { cn } from '@/app/lib/utils'

// Analytics seam: we don't have an analytics service wired up yet, but every
// external link click flows through here so tracking can be added in one place
// once one exists.
function trackLinkClick(url: string): void {
  void url
}

export function Link({
  children,
  className,
  href,
  onClick,
  rel = 'noreferrer noopener',
  target = '_blank',
  ...props
}: React.ComponentProps<'a'>): ReactElement {
  const handleClick = (event: MouseEvent<HTMLAnchorElement>) => {
    onClick?.(event)

    if (event.defaultPrevented || !href) {
      return
    }

    event.preventDefault()
    trackLinkClick(href)

    window.electron.openUrl(href).catch((error: unknown) => {
      console.error('Failed to open external link:', error)
    })
  }

  return (
    <a
      className={cn(className)}
      href={href}
      onClick={handleClick}
      rel={rel}
      target={target}
      {...props}
    >
      {children}
    </a>
  )
}
