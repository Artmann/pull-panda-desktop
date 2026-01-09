import { useCallback } from 'react'

import { useAppDispatch, useAppSelector } from './hooks'
import { draftsActions } from './drafts-slice'

export function useDraft(key: string) {
  const dispatch = useAppDispatch()
  const body = useAppSelector((state) => state.drafts[key] ?? '')

  const setBody = useCallback(
    (value: string) => {
      dispatch(draftsActions.setDraft({ key, body: value }))
    },
    [dispatch, key]
  )

  const clearDraft = useCallback(() => {
    dispatch(draftsActions.clearDraft({ key }))
  }, [dispatch, key])

  return { body, setBody, clearDraft }
}
