// Badge UI primitive — implemented in Phase 4, per ARCHITECTURE.md §7/§6.
import type { ComponentPropsWithoutRef } from 'react'

type BadgeVariant = 'success' | 'destructive' | 'muted'

const variantClasses: Record<BadgeVariant, string> = {
  success: 'bg-success/10 text-success',
  destructive: 'bg-destructive/10 text-destructive',
  muted: 'bg-muted-foreground/10 text-muted-foreground',
}

interface BadgeProps extends ComponentPropsWithoutRef<'span'> {
  variant?: BadgeVariant
}

export function Badge({ variant = 'muted', className, ...props }: BadgeProps) {
  const classes = [
    'inline-flex h-6 items-center rounded-full px-2 py-0.5 text-xs font-medium transition-colors duration-150',
    variantClasses[variant],
    className,
  ]
    .filter(Boolean)
    .join(' ')
  return <span className={classes} {...props} />
}
