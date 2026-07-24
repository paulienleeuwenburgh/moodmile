import { useEffect } from 'react'

const DEFAULT_TITLE = 'MoodMile'

export function useDocumentTitle(title?: string) {
  useEffect(() => {
    document.title = title?.trim() || DEFAULT_TITLE
  }, [title])
}
