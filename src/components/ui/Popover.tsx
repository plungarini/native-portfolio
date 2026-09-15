// Shared popover primitive: a trigger that opens a panel, rendered two ways
// depending on viewport so nothing ever falls back to a corner-anchored
// `absolute` box that looks broken on a phone screen —
//   - `sm:` and up: the classic anchored dropdown (`Card`-based), positioned
//     near the trigger.
//   - below `sm:`: the same content inside `Modal`, i.e. the same
//     near-fullscreen centered sheet treatment already used by the PnL
//     Calendar. Both are mounted at once; only one is ever visible or in
//     the accessibility tree at a given width (`hidden`/`sm:hidden` maps to
//     `display:none`, which removes an element from the a11y tree too).
import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { X } from '@phosphor-icons/react'
import { Card } from './Card'
import { Modal } from './Modal'
import { useOutsideDismiss } from '../../hooks/useOutsideDismiss'

function cx(...classes: Array<string | undefined | false>): string {
  return classes.filter(Boolean).join(' ')
}

/** Mounted fresh each time the popover opens (its parent only renders it
 * inside `open && (...)`), so `entered` naturally starts `false` on every
 * open without ever needing an explicit reset — resetting a persistent
 * piece of state on close would mean a synchronous `setState` in an effect
 * body, which `react-hooks/set-state-in-effect` flags. */
function AnimatedDesktopPanel({
  align,
  panelClassName,
  title,
  onClose,
  children,
}: {
  align: 'left' | 'right'
  panelClassName?: string
  title?: string
  onClose: () => void
  children: ReactNode
}) {
  const [entered, setEntered] = useState(false)

  useEffect(() => {
    const frame = requestAnimationFrame(() => setEntered(true))
    return () => cancelAnimationFrame(frame)
  }, [])

  return (
    <div
      className={cx(
        'absolute z-40 mt-2 hidden w-80 transition-[opacity,transform] duration-150 ease-out sm:block',
        align === 'right' ? 'right-0' : 'left-0',
        entered ? 'scale-100 opacity-100' : 'scale-95 opacity-0',
      )}
    >
      <Card className={cx('relative p-3 shadow-lg', panelClassName)}>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-3 top-3 rounded-lg p-1 text-muted-foreground transition-colors duration-150 hover:bg-border/50 hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          <X weight="bold" className="size-4" />
        </button>
        {title !== undefined && (
          <h2 className="mb-2 pr-6 px-1 text-sm font-medium text-foreground">{title}</h2>
        )}
        {children}
      </Card>
    </div>
  )
}

interface PopoverProps {
  open: boolean
  onClose: () => void
  trigger: ReactNode
  title?: string
  align?: 'left' | 'right'
  panelClassName?: string
  children: ReactNode
}

export function Popover({
  open,
  onClose,
  trigger,
  title,
  align = 'left',
  panelClassName,
  children,
}: PopoverProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  useOutsideDismiss(containerRef, open, onClose)

  return (
    <div ref={containerRef} className="relative inline-block">
      {trigger}

      {open && (
        <>
          <AnimatedDesktopPanel align={align} panelClassName={panelClassName} title={title} onClose={onClose}>
            {children}
          </AnimatedDesktopPanel>

          <div className="sm:hidden">
            <Modal open={open} onClose={onClose} title={title}>
              {children}
            </Modal>
          </div>
        </>
      )}
    </div>
  )
}
