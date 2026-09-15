// Shared outside-click/Escape dismiss behavior for popovers — lifted out of
// WalletManager's original implementation so it isn't reimplemented per
// consumer (Popover, and anything built on it, share this one copy).
import { useEffect } from 'react'
import type { RefObject } from 'react'

export function useOutsideDismiss(
  containerRef: RefObject<HTMLElement | null>,
  active: boolean,
  onDismiss: () => void,
): void {
  useEffect(() => {
    if (!active) return

    const handlePointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) onDismiss()
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onDismiss()
    }
    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [active, containerRef, onDismiss])
}
