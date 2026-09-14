// Allocation breakdown chip legend + stacked bar — Phase 4, per ARCHITECTURE.md §6.
import type { Holding } from '../../hooks/useHoldings'

const PALETTE = ['#c7f284', '#35d399', '#7dd3fc', '#fbbf24', '#fb7185', '#a78bfa', '#f472b6', '#67e8f9']

function colorForIndex(index: number): string {
  return PALETTE[index % PALETTE.length]
}

interface AllocationBreakdownProps {
  holdings: Holding[]
}

export function AllocationBreakdown({ holdings }: AllocationBreakdownProps) {
  if (holdings.length === 0) {
    return <p className="text-xs text-muted-foreground">No tokens detected</p>
  }

  const total = holdings.reduce((sum, h) => sum + (h.usdValue ?? 0), 0)

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {holdings.map((holding, index) => {
          const color = colorForIndex(index)
          const pct = holding.usdValue !== null && total > 0 ? (holding.usdValue / total) * 100 : null
          return (
            <div
              key={holding.key}
              className="flex max-w-[220px] items-center gap-1.5 rounded-full bg-muted px-2 py-1"
            >
              <span
                className="h-[28px] w-[28px] shrink-0 rounded-full"
                style={{ backgroundColor: color, boxShadow: `0 0 0 2px ${color}` }}
              />
              <span className="min-w-0 truncate text-xs font-medium text-foreground">{holding.symbol}</span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {pct !== null ? `${pct.toFixed(1)}%` : 'price unavailable'}
              </span>
            </div>
          )
        })}
      </div>

      <div className="relative flex h-[18px] gap-px overflow-hidden rounded">
        {holdings
          .filter((h) => h.usdValue !== null && total > 0)
          .map((holding) => {
            const index = holdings.indexOf(holding)
            const pct = ((holding.usdValue ?? 0) / total) * 100
            return (
              <span
                key={holding.key}
                className="h-full"
                style={{ width: `${pct}%`, backgroundColor: colorForIndex(index) }}
              />
            )
          })}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded opacity-20"
          style={{
            backgroundImage:
              'repeating-linear-gradient(45deg, #000 0, #000 2px, transparent 2px, transparent 6px)',
          }}
        />
      </div>

      <p className="text-xs text-muted-foreground">{holdings.length} tokens detected</p>
    </div>
  )
}
