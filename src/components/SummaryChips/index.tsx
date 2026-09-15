// Chip strip under the hero cards, mirroring jup.ag/portfolio's per-protocol
// row. Ours is per-category/chain (Holdings, Solana, BSC).
import type { ReactNode } from 'react'

function cx(...classes: Array<string | undefined | false>): string {
  return classes.filter(Boolean).join(' ')
}

export interface SummaryChip {
  key: string
  label: string
  value: string
  icon?: ReactNode
  selected?: boolean
}

interface SummaryChipsProps {
  chips: SummaryChip[]
  onSelect?: (key: string) => void
}

const CHIP_BASE =
  'flex shrink-0 items-center gap-2.5 rounded-lg bg-border/50 p-2.5 pr-8 text-left'
const CHIP_INTERACTIVE =
  'cursor-pointer transition-transform duration-150 ease-out hover:bg-border active:scale-[0.99]'
const CHIP_SELECTED = 'ring-1 ring-accent/40'

function ChipContent({ chip }: { chip: SummaryChip }) {
  return (
    <>
      {chip.icon ? (
        <span className="flex size-7 shrink-0 items-center justify-center overflow-hidden rounded-full">
          {chip.icon}
        </span>
      ) : null}
      <span className="flex flex-col gap-0.5">
        <span className="text-xs text-muted-foreground">{chip.label}</span>
        <span className="text-sm font-medium text-foreground">{chip.value}</span>
      </span>
    </>
  )
}

export function SummaryChips({ chips, onSelect }: SummaryChipsProps) {
  if (chips.length === 0) return null

  return (
    <div className="scrollbar-none flex min-w-0 max-w-full items-center gap-2.5 overflow-x-auto overflow-y-hidden">
      {chips.map((chip) =>
        onSelect ? (
          <button
            key={chip.key}
            type="button"
            aria-pressed={chip.selected ?? false}
            onClick={() => onSelect(chip.key)}
            className={cx(CHIP_BASE, CHIP_INTERACTIVE, chip.selected && CHIP_SELECTED)}
          >
            <ChipContent chip={chip} />
          </button>
        ) : (
          <div
            key={chip.key}
            className={cx(CHIP_BASE, chip.selected && CHIP_SELECTED)}
          >
            <ChipContent chip={chip} />
          </div>
        ),
      )}
    </div>
  )
}
