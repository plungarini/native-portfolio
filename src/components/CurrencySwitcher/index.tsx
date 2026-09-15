import { useState } from 'react'
import { CaretDown, Check } from '@phosphor-icons/react'
import { Popover } from '../ui/Popover'
import { TokenIcon } from '../ui/TokenIcon'

interface CurrencySwitcherProps {
  value: string
  onChange: (symbol: string) => void
  options: string[]
}

export function CurrencySwitcher({ value, onChange, options }: CurrencySwitcherProps) {
  const [open, setOpen] = useState(false)

  return (
    <Popover
      open={open}
      onClose={() => setOpen(false)}
      align="right"
      title="Currency"
      trigger={
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-haspopup="listbox"
          className="flex items-center gap-2 rounded-xl px-2 py-1.5 transition-colors duration-150 hover:bg-border/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:scale-[0.98]"
        >
          <TokenIcon symbol={value} size={24} />
          <span className="text-sm font-medium text-foreground">{value}</span>
          <CaretDown weight="bold" className="size-3.5 shrink-0 text-muted-foreground" />
        </button>
      }
    >
      <ul role="listbox" aria-label="Currency" className="flex flex-col gap-0.5">
        {options.map((symbol) => {
          const active = symbol === value
          return (
            <li key={symbol}>
              <button
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => {
                  onChange(symbol)
                  setOpen(false)
                }}
                className={`flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors duration-150 hover:bg-muted/50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                  active ? 'text-foreground' : 'text-muted-foreground'
                }`}
              >
                <TokenIcon symbol={symbol} size={20} />
                <span className="flex-1 truncate text-left">{symbol}</span>
                {active && <Check weight="bold" className="size-4 shrink-0 text-accent" />}
              </button>
            </li>
          )
        })}
      </ul>
    </Popover>
  )
}
