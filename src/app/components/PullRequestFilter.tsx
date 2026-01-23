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
      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />

      <Input
        className="pl-8"
        maxLength={100}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Filter pull requests..."
        type="text"
        value={value}
      />
    </div>
  )
}
