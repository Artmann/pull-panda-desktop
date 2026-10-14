import { ChevronLeftIcon } from 'lucide-react'
import { type ReactElement } from 'react'

import { countLabel, type SidebarView } from './sidebar-data'

interface SidebarViewSwitchProps {
  count: number
  hiddenCount: number
  onViewChange: (view: SidebarView) => void
  view: SidebarView
}

const linkClassName =
  'hover:text-sidebar-foreground focus-visible:ring-sidebar-ring cursor-pointer rounded-sm uppercase transition-colors outline-none focus-visible:ring-2'

/**
 * The list's count, with a quiet way into the hidden pull requests beside it,
 * and back out again. The link only shows up once something has been hidden.
 */
export function SidebarViewSwitch({
  count,
  hiddenCount,
  onViewChange,
  view
}: SidebarViewSwitchProps): ReactElement {
  if (view === 'hidden') {
    return (
      <button
        className={`${linkClassName} flex shrink-0 items-center gap-1 whitespace-nowrap`}
        onClick={() => onViewChange('main')}
        type="button"
      >
        <ChevronLeftIcon className="size-3 shrink-0" />
        {count.toString()} hidden
      </button>
    )
  }

  return (
    <span className="flex shrink-0 items-center gap-1.5 whitespace-nowrap">
      <span>{countLabel(count)}</span>

      {hiddenCount > 0 && (
        <>
          <span aria-hidden>·</span>

          <button
            className={`${linkClassName} font-medium opacity-70 hover:opacity-100`}
            onClick={() => onViewChange('hidden')}
            type="button"
          >
            {hiddenCount.toString()} hidden
          </button>
        </>
      )}
    </span>
  )
}
