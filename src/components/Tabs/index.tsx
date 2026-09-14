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
    <div className="flex gap-6 border-b border-border" role="tablist">
      {tabs.map((tab) => {
        const active = tab.key === activeKey
        return (
          <button
            key={tab.key}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.key)}
            className={`relative pb-3 text-sm font-medium ${
              active ? 'text-foreground' : 'text-muted-foreground'
            }`}
          >
            {tab.label}
            {active && (
              <span className="absolute inset-x-0 -bottom-px mx-auto h-0.5 w-6 rounded-full bg-accent" />
            )}
          </button>
        )
      })}
    </div>
  )
}
