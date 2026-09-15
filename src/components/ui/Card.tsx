// Card primitive mirroring jup.ag/portfolio's card recipe:
//   rounded-2xl bg-card + hairline border-foreground/[0.03], p-4 internal
//   spacing, header/body split with the header's bottom padding collapsed.
import type { ReactNode } from 'react'

function cx(...classes: Array<string | undefined | false>): string {
  return classes.filter(Boolean).join(' ')
}

interface CardProps {
  children: ReactNode
  className?: string
}

export function Card({ children, className }: CardProps) {
  return (
    <div
      className={cx(
        'relative flex flex-col overflow-hidden rounded-2xl border border-foreground/[0.03] bg-card text-sm text-foreground',
        className,
      )}
    >
      {children}
    </div>
  )
}

export function CardHeader({ children, className }: CardProps) {
  return (
    <header className={cx('flex items-center justify-between p-4 pb-0', className)}>
      {children}
    </header>
  )
}

export function CardBody({ children, className }: CardProps) {
  return <div className={cx('flex flex-col p-4', className)}>{children}</div>
}
