// Pill UI primitive — implemented in Phase 4, per ARCHITECTURE.md §7/§6.
import type { ComponentPropsWithoutRef } from 'react'

type PillVariant = 'default' | 'accent'

const variantClasses: Record<PillVariant, string> = {
  default: 'bg-border/70 text-foreground',
  accent: 'bg-accent/20 text-accent',
}

interface PillProps extends ComponentPropsWithoutRef<'span'> {
  variant?: PillVariant
}

export function Pill({ variant = 'default', className, ...props }: PillProps) {
  const classes = ['inline-flex items-center rounded-full px-2.5 py-1', variantClasses[variant], className]
    .filter(Boolean)
    .join(' ')
  return <span className={classes} {...props} />
}
