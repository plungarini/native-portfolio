import { Pill } from '../ui/Pill'

interface CurrencySwitcherProps {
  value: string
  onChange: (symbol: string) => void
  options: string[]
}

export function CurrencySwitcher({ value, onChange, options }: CurrencySwitcherProps) {
  return (
    <div
      className="inline-flex max-w-full items-center gap-1 overflow-x-auto rounded-full bg-input p-1"
      role="group"
    >
      {options.map((symbol) => {
        const active = symbol === value
        return (
          <button
            key={symbol}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(symbol)}
            className="rounded-full"
          >
            <Pill variant={active ? 'accent' : 'muted'}>{symbol}</Pill>
          </button>
        )
      })}
    </div>
  )
}
