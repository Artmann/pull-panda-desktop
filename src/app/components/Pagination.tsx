import { ChevronLeft, ChevronRight } from 'lucide-react'
import { type ReactElement } from 'react'

import { Button } from './ui/button'

interface PaginationProps {
  currentPage: number
  onPageChange: (page: number) => void
  totalPages: number
}

export function Pagination({
  currentPage,
  onPageChange,
  totalPages
}: PaginationProps): ReactElement | null {
  if (totalPages <= 1) {
    return null
  }

  const canGoBack = currentPage > 1
  const canGoForward = currentPage < totalPages

  return (
    <div className="flex items-center justify-center gap-2">
      <Button
        disabled={!canGoBack}
        onClick={() => onPageChange(currentPage - 1)}
        size="sm"
        variant="outline"
      >
        <ChevronLeft className="h-4 w-4" />
        <span className="sr-only">Previous page</span>
      </Button>

      <span className="text-sm text-muted-foreground">
        Page {currentPage} of {totalPages}
      </span>

      <Button
        disabled={!canGoForward}
        onClick={() => onPageChange(currentPage + 1)}
        size="sm"
        variant="outline"
      >
        <ChevronRight className="h-4 w-4" />
        <span className="sr-only">Next page</span>
      </Button>
    </div>
  )
}
