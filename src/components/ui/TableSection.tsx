import type { ReactNode } from 'react'

interface TableSectionProps {
  title: string
  badge?: ReactNode
  children: ReactNode
}

export function TableSection({ title, badge, children }: TableSectionProps) {
  return (
    <section className="rounded-2xl bg-card max-sm:rounded-none max-sm:-mx-5">
      <header className="flex items-center justify-between rounded-xl bg-border/50 px-4 py-2">
        <h2 className="text-sm font-medium text-foreground">{title}</h2>
        {badge !== undefined && (
          <span className="rounded-full bg-border/70 px-2.5 py-1 text-xs text-foreground-secondary">
            {badge}
          </span>
        )}
      </header>
      <div className="px-3 pb-2.5">{children}</div>
    </section>
  )
}
