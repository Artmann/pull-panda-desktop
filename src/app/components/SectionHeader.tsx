import { memo, type ReactElement, type ReactNode } from 'react'

export const SectionHeader = memo(function SectionHeader({
  children,
  id
}: {
  children: ReactNode
  id?: string
}): ReactElement {
  return (
    <h2
      className="text-lg font-semibold text-gray-900 dark:text-gray-100 leading-tight mb-3"
      data-testid={id}
      id={id}
    >
      {children}
    </h2>
  )
})
