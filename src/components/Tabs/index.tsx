interface Tab {
  key: string
  label: string
}

interface TabsProps {
  tabs: Tab[]
  activeKey: string
  onChange: (key: string) => void
}

export function Tabs({ tabs, activeKey, onChange }: TabsProps) {
  return (
    <div className="flex h-11 flex-row items-stretch justify-between">
      <nav
        role="tablist"
        className="scrollbar-none flex flex-row items-stretch gap-8 self-stretch max-sm:w-full max-sm:justify-start max-sm:overflow-x-auto"
      >
        {tabs.map((tab) => {
          const active = tab.key === activeKey
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChange(tab.key)}
              className={`relative flex shrink-0 cursor-pointer items-center whitespace-nowrap text-sm font-medium transition lg:text-base ${
                active
                  ? 'text-foreground'
                  : 'text-muted-foreground hover:text-foreground-secondary'
              }`}
            >
              {tab.label}
              {active && (
                <span
                  data-testid={`tab-indicator-${tab.key}`}
                  className="pointer-events-none absolute -bottom-px left-1/2 h-0.5 w-6 -translate-x-1/2 rounded-full bg-accent"
                />
              )}
            </button>
          )
        })}
      </nav>
    </div>
  )
}
