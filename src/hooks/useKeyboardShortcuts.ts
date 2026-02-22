import { useEffect, useCallback } from 'react'

export interface KeyboardShortcut {
  key: string
  ctrlKey?: boolean
  shiftKey?: boolean
  altKey?: boolean
  action: () => void
  preventDefault?: boolean
}

export const useKeyboardShortcuts = (shortcuts: KeyboardShortcut[], enabled = true) => {
  const handleKeyDown = useCallback((event: KeyboardEvent) => {
    if (!enabled) return

    const matchingShortcut = shortcuts.find(shortcut => {
      const keyMatches = shortcut.key.toLowerCase() === event.key.toLowerCase()
      const ctrlMatches = !!shortcut.ctrlKey === event.ctrlKey
      const shiftMatches = !!shortcut.shiftKey === event.shiftKey
      const altMatches = !!shortcut.altKey === event.altKey

      return keyMatches && ctrlMatches && shiftMatches && altMatches
    })

    if (matchingShortcut) {
      if (matchingShortcut.preventDefault !== false) {
        event.preventDefault()
      }
      matchingShortcut.action()
    }
  }, [shortcuts, enabled])

  useEffect(() => {
    if (enabled) {
      document.addEventListener('keydown', handleKeyDown)
      return () => {
        document.removeEventListener('keydown', handleKeyDown)
      }
    }
  }, [handleKeyDown, enabled])
}
