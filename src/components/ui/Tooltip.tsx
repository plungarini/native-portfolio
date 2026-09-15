// Tooltip UI primitive — implemented in Phase 4, per ARCHITECTURE.md §7/§6.
import { cloneElement, isValidElement, useId, useState } from 'react'
import type { ReactElement, ReactNode } from 'react'

interface TooltipProps {
  content: ReactNode
  children: ReactElement
}

export function Tooltip({ content, children }: TooltipProps) {
  const [visible, setVisible] = useState(false)
  const id = useId()

  const show = () => setVisible(true)
  const hide = () => setVisible(false)

  const trigger = isValidElement<Record<string, unknown>>(children)
    ? cloneElement(children, {
        'aria-describedby': visible ? id : undefined,
        onMouseEnter: show,
        onMouseLeave: hide,
        onFocus: show,
        onBlur: hide,
      })
    : children

  return (
    <span className="relative inline-flex min-w-0">
      {trigger}
      <span
        id={id}
        role="tooltip"
        aria-hidden={!visible}
        className={[
          'pointer-events-none absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 whitespace-nowrap rounded-sm bg-input px-2 py-1 text-xs text-foreground-secondary shadow-lg',
          'transition-[opacity,transform] duration-150 ease-out',
          visible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-1',
        ].join(' ')}
      >
        {content}
      </span>
    </span>
  )
}
