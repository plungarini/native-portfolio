import { Pill } from '../ui/Pill'

interface CurrencySwitcherProps {
  value: string
  onChange: (symbol: string) => void
  options: string[]
}

export function CurrencySwitcher({ value, onChange, options }: CurrencySwitcherProps) {
  return (
    <div className="inline-flex items-center gap-1 rounded-full bg-input p-1" role="group">
      {options.map((symbol) => {
        const active = symbol === value
        return (
          <button
            key={symbol}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(symbol)}
          >
            <Pill variant={active ? 'accent' : 'default'}>{symbol}</Pill>
          </button>
        )
      })}
    </div>
  )
}
