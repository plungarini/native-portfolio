// Per-token holdings table — implemented in Phase 4/5, per ARCHITECTURE.md §6.
import type { Holding } from '../../hooks/useHoldings'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/Table'
import { TableSection } from '../ui/TableSection'
import { formatUsd } from '../../lib/format/currency'
import { formatAmount } from '../../lib/format/number'

interface HoldingsTableProps {
  holdings: Holding[]
  mainCurrency: string
}

const AVATAR_COLORS = ['#c7f284', '#35d399', '#fb7185', '#90a1b9', '#e2e8f0']

function avatarColorFor(symbol: string): string {
  let hash = 0
  for (let i = 0; i < symbol.length; i++) hash = (hash * 31 + symbol.charCodeAt(i)) >>> 0
  return AVATAR_COLORS[hash % AVATAR_COLORS.length]
}

export function HoldingsTable({ holdings, mainCurrency }: HoldingsTableProps) {
  return (
    <TableSection title="Holdings" badge={holdings.length}>
      {holdings.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">No holdings yet</p>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[270px]">Asset</TableHead>
              <TableHead>Value/Balance</TableHead>
              <TableHead>Price</TableHead>
              {/* 24h Δ omitted — not in the Holding data model yet */}
              <TableHead>PnL</TableHead>
              <TableHead>Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {holdings.map((holding) => {
              const priceUnavailable = holding.currentUsdPrice === null

              return (
                <TableRow key={holding.key}>
                  <TableCell className="w-[270px]">
                    <div className="flex min-w-0 items-center gap-2 py-2">
                      <span
                        aria-hidden="true"
                        className="h-7 w-7 shrink-0 rounded-full"
                        style={{ backgroundColor: avatarColorFor(holding.symbol) }}
                      />
                      <span className="min-w-0 truncate text-sm font-medium text-foreground">
                        {holding.symbol}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell>
                    <div className="text-sm font-medium text-foreground">
                      {priceUnavailable
                        ? 'price unavailable'
                        : `${formatAmount(holding.mainCurrencyValue ?? 0, { maxFractionDigits: 4 })} ${mainCurrency}`}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {priceUnavailable
                        ? `${formatAmount(holding.amountToken, { maxFractionDigits: 4 })} ${holding.symbol}`
                        : `(${formatUsd(holding.usdValue)})`}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-foreground">
                      {priceUnavailable ? 'price unavailable' : formatUsd(holding.currentUsdPrice)}
                    </span>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground">—</span>
                  </TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground">—</span>
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
      )}
    </TableSection>
  )
}
