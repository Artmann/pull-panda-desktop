// Agent CLIs report terminal problems — session limits, authentication
// failures — both as assistant text and as the run's error result. Left alone
// the same sentence renders twice: once as the message body and once as the
// error bubble. Drop it from the body so only the error bubble shows it.
export function contentWithoutFailureMessage(
  content: string,
  failureMessage: string
): string {
  const trimmedContent = content.trim()
  const trimmedFailureMessage = failureMessage.trim()

  if (
    trimmedFailureMessage.length === 0 ||
    !trimmedContent.endsWith(trimmedFailureMessage)
  ) {
    return content
  }

  return trimmedContent
    .slice(0, trimmedContent.length - trimmedFailureMessage.length)
    .trimEnd()
}
