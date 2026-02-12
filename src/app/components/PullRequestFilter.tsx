import { Search } from 'lucide-react'
import { type ReactElement } from 'react'

import { Input } from './ui/input'

interface PullRequestFilterProps {
  onChange: (value: string) => void
  value: string
}

export function PullRequestFilter({
  onChange,
  value
}: PullRequestFilterProps): ReactElement {
  return (
    <div className="relative max-w-sm">
      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-3 text-muted-foreground" />

      <Input
        className="pl-7"
        maxLength={100}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Filter pull requests..."
        size="sm"
        type="text"
        value={value}
      />
    </div>
  )
}
