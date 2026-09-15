// Deposits/withdrawals summary card — surfaces the one-sided transfers
// useActivity previously discarded entirely (per §3.4, they're not
// "activity", but they still moved funds in/out and are exactly what lets
// a user sanity-check the PnL figures above against real inflows/outflows).
import { ArrowDown, ArrowUp } from '@phosphor-icons/react'
import { Card, CardBody, CardHeader } from '../ui/Card'
import type { TransferRow } from '../../hooks/useActivity'
import { formatMainCurrency, formatUsd } from '../../lib/format/currency'
import { FIXED_UNIT_CURRENCIES } from '../../config/currencies'

interface TransferSummaryCardProps {
  transfers: TransferRow[]
  direction: 'deposit' | 'withdrawal'
  mainCurrency: string
}

function sumLegField(rows: TransferRow[], pick: (leg: TransferRow['legs'][number]) => number | null): number | null {
  let total = 0
  let sawValue = false
  for (const row of rows) {
    for (const leg of row.legs) {
      const value = pick(leg)
      if (value !== null && Number.isFinite(value)) {
        total += value
        sawValue = true
      }
    }
  }
  return sawValue ? total : null
}

export function TransferSummaryCard({ transfers, direction, mainCurrency }: TransferSummaryCardProps) {
  const rows = transfers.filter((t) => t.direction === direction)
  const isFixedUnitCurrency = FIXED_UNIT_CURRENCIES.has(mainCurrency.toUpperCase())

  const totalMainCurrency = sumLegField(rows, (leg) => leg.valueMainCurrency)
  const totalUsd = sumLegField(rows, (leg) => leg.valueUsd)

  const bigValue = isFixedUnitCurrency ? totalUsd : totalMainCurrency
  const bigText = isFixedUnitCurrency
    ? formatUsd(bigValue)
    : formatMainCurrency(bigValue, mainCurrency)

  const label = direction === 'deposit' ? 'Deposits' : 'Withdrawals'
  const Icon = direction === 'deposit' ? ArrowDown : ArrowUp
  const iconTone = direction === 'deposit' ? 'text-success' : 'text-destructive'

  return (
    <Card className="flex-1">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-1.5">
          <Icon weight="bold" className={`size-3.5 ${iconTone}`} aria-hidden="true" />
          <span className="text-sm font-medium text-foreground">{label}</span>
        </div>
      </CardHeader>
      <CardBody className="gap-0.5 pt-0">
        <span
          className={
            bigValue === null
              ? 'text-2xl font-semibold tracking-tight text-muted-foreground'
              : 'text-2xl font-semibold tracking-tight text-foreground'
          }
        >
          {bigText}
        </span>
        {!isFixedUnitCurrency && totalMainCurrency !== null && (
          <span className="text-xs text-muted-foreground">{formatUsd(totalUsd)}</span>
        )}
        <span className="mt-1 text-xs text-foreground-faint">
          {rows.length} {rows.length === 1 ? 'transaction' : 'transactions'}
        </span>
      </CardBody>
    </Card>
  )
}
