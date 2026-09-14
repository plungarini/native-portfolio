// Table UI primitive — implemented in Phase 4, per ARCHITECTURE.md §7/§6.
import type { ComponentPropsWithoutRef } from 'react'

function cx(...classes: Array<string | undefined>): string {
  return classes.filter(Boolean).join(' ')
}

export function Table({ className, ...props }: ComponentPropsWithoutRef<'table'>) {
  return <table className={cx('w-full border-collapse', className)} {...props} />
}

export function TableHeader({ className, ...props }: ComponentPropsWithoutRef<'thead'>) {
  return <thead className={className} {...props} />
}

export function TableBody({ className, ...props }: ComponentPropsWithoutRef<'tbody'>) {
  return <tbody className={className} {...props} />
}

export function TableRow({ className, ...props }: ComponentPropsWithoutRef<'tr'>) {
  return <tr className={cx('hover:bg-muted/50', className)} {...props} />
}

export function TableHead({ className, ...props }: ComponentPropsWithoutRef<'th'>) {
  return (
    <th
      className={cx('h-12 px-2 text-left text-xs font-light text-muted-foreground', className)}
      {...props}
    />
  )
}

export function TableCell({ className, ...props }: ComponentPropsWithoutRef<'td'>) {
  return <td className={cx('px-2', className)} {...props} />
}
