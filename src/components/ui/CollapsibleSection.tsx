// Collapsible section mirroring jup.ag/portfolio's <details>/<summary> pattern:
// a `rounded-xl bg-border/50` summary strip with a leading icon + title, a
// trailing value, and a caret that rotates when open.
import type { ReactNode } from 'react'
import { CaretDown } from '@phosphor-icons/react'

function cx(...classes: Array<string | undefined | false>): string {
  return classes.filter(Boolean).join(' ')
}

interface CollapsibleSectionProps {
  title: ReactNode
  /** Right-aligned value, e.g. the section's total. */
  value?: ReactNode
  icon?: ReactNode
  defaultOpen?: boolean
  /** `lg` is the outer section strip, `sm` the nested sub-section strip. */
  size?: 'lg' | 'sm'
  children: ReactNode
}

export function CollapsibleSection({
  title,
  value,
  icon,
  defaultOpen = true,
  size = 'lg',
  children,
}: CollapsibleSectionProps) {
  return (
    <details className="group/section" open={defaultOpen}>
      <summary
        className={cx(
          'flex cursor-pointer list-none items-center justify-between rounded-xl px-3 py-2',
          size === 'lg' ? 'bg-transparent' : 'bg-border/50',
        )}
      >
        <div className="flex min-w-0 items-center gap-2">
          {icon}
          <span
            className={cx(
              'truncate font-medium text-foreground',
              size === 'lg' ? 'text-lg' : 'text-sm',
            )}
          >
            {title}
          </span>
        </div>
        <div className="flex shrink-0 items-center gap-4">
          {value !== undefined && (
            <span
              className={cx(
                'whitespace-nowrap font-medium text-foreground',
                size === 'lg' ? 'text-lg' : 'text-sm',
              )}
            >
              {value}
            </span>
          )}
          <CaretDown
            weight="bold"
            className="size-3 shrink-0 transition-transform duration-300 group-open/section:rotate-180"
          />
        </div>
      </summary>
      <div className="pt-1">{children}</div>
    </details>
  )
}
