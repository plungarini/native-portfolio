// Skeleton UI primitive — implemented in Phase 4, per ARCHITECTURE.md §7/§6.
import type { ComponentPropsWithoutRef } from 'react'

interface SkeletonProps extends ComponentPropsWithoutRef<'div'> {
  rounded?: string
}

export function Skeleton({ className, rounded = 'rounded-md', ...props }: SkeletonProps) {
  // Stock Tailwind's `animate-pulse` bundles a fixed 2s duration into one utility class —
  // there's no separate `duration-*` utility that retunes it, and every call site already
  // relies on the exact "animate-pulse bg-muted" pairing, so it's kept as the safe default
  // rather than swapped for an arbitrary-value animation that would drop that literal class.
  const classes = ['animate-pulse bg-muted', rounded, className].filter(Boolean).join(' ')
  return <div className={classes} {...props} />
}
