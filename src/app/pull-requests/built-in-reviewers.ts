export interface BuiltInReviewer {
  avatarUrl: string
  description: string
  displayName: string
  login: string
}

export const builtInReviewers: BuiltInReviewer[] = [
  {
    avatarUrl: 'https://avatars.githubusercontent.com/in/946600?v=4',
    description: 'Your AI Pair Programmer',
    displayName: 'Copilot',
    login: 'copilot-pull-request-reviewer'
  }
]

const byLogin = new Map(
  builtInReviewers.map((reviewer) => [reviewer.login, reviewer])
)

export function getBuiltInReviewer(login: string): BuiltInReviewer | undefined {
  return byLogin.get(login)
}
