import { memo, type ReactElement } from 'react'

import { Avatar, AvatarFallback, AvatarImage } from './ui/avatar'

export const UserAvatar = memo(function UserAvatar({
  avatarUrl,
  login
}: {
  avatarUrl?: string | null
  login?: string | null
}): ReactElement {
  const displayLogin = login ?? 'User'

  return (
    <Avatar className="size-7 border-2 border-white shadow-sm">
      <AvatarImage
        alt={displayLogin}
        src={avatarUrl ?? undefined}
      />
      <AvatarFallback className="text-xs bg-gray-100">
        {displayLogin
          .split(' ')
          .map((n) => n[0])
          .join('')
          .toUpperCase()
          .slice(0, 2)}
      </AvatarFallback>
    </Avatar>
  )
})
