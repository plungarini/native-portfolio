// Skeleton UI primitive — implemented in Phase 4, per ARCHITECTURE.md §7/§6.
import type { ComponentPropsWithoutRef } from 'react'

interface SkeletonProps extends ComponentPropsWithoutRef<'div'> {
  rounded?: string
}

export function Skeleton({ className, rounded = 'rounded-md', ...props }: SkeletonProps) {
  const classes = ['animate-pulse bg-muted', rounded, className].filter(Boolean).join(' ')
  return <div className={classes} {...props} />
}
