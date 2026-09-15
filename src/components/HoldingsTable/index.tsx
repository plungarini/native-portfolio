// Per-token holdings table — Jupiter-density layout, per ARCHITECTURE.md §6.
import { SealCheck } from '@phosphor-icons/react'
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
import { TokenIcon } from '../ui/TokenIcon'
import { Tooltip } from '../ui/Tooltip'
import { PRICE_UNAVAILABLE, formatMainCurrency, formatSignedUsd, formatUsd } from '../../lib/format/currency'
import { formatAmount } from '../../lib/format/number'

export interface HoldingPnl {
  usd: number
  percent: number
}

interface HoldingsTableProps {
  holdings: Holding[]
  mainCurrency: string
  /** All-time PnL per holding key. Absent keys render an em dash — the
   * Holding model carries no PnL, so nothing is inferred from price alone. */
  pnlByKey?: Record<string, HoldingPnl>
}

const EM_DASH = '—'

function signClass(value: number): string {
  return value >= 0 ? 'text-success' : 'text-destructive'
}

function formatSignedPercent(value: number): string {
  const sign = value > 0 ? '+' : ''
  return `${sign}${formatAmount(value, { minFractionDigits: 2, maxFractionDigits: 2 })}%`
}

function byUsdValueDesc(a: Holding, b: Holding): number {
  if (a.usdValue === null && b.usdValue === null) return 0
  if (a.usdValue === null) return 1
  if (b.usdValue === null) return -1
  return b.usdValue - a.usdValue
}

export function HoldingsTable({ holdings, mainCurrency, pnlByKey }: HoldingsTableProps) {
  const rows = [...holdings].sort(byUsdValueDesc)

  return (
    <TableSection title="Holdings" badge={holdings.length}>
      {rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">No holdings yet</p>
      ) : (
        <div className="relative w-full overflow-x-auto overflow-y-hidden overscroll-x-contain">
          <Table className="table-fixed caption-bottom text-sm max-sm:min-w-max">
            <TableHeader>
              <TableRow>
                <TableHead className="w-[260px] px-3">Asset</TableHead>
                <TableHead className="w-[150px] px-3">Value/Balance</TableHead>
                <TableHead className="w-[130px] px-3 text-right">Price/24hΔ</TableHead>
                <TableHead className="w-[140px] px-3 text-right">PnL (all time)</TableHead>
                <TableHead className="w-[110px] px-3 text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((holding) => {
                const priceUnavailable = holding.currentUsdPrice === null
                const balanceText = `${formatAmount(holding.amountToken, { maxFractionDigits: 4 })} ${holding.symbol}`
                const pnl = pnlByKey?.[holding.key]

                return (
                  <TableRow key={holding.key}>
                    <TableCell className="min-w-0 overflow-hidden whitespace-nowrap p-3 py-2.5 align-middle text-sm font-medium text-foreground">
                      <div className="flex items-center gap-3">
                        <TokenIcon symbol={holding.symbol} iconUrl={holding.iconUrl} size={28} />
                        <div className="flex min-w-0 items-center gap-1.5">
                          <Tooltip content={holding.name}>
                            <span className="min-w-0 truncate text-sm font-medium text-foreground">
                              {holding.symbol}
                            </span>
                          </Tooltip>
                          {holding.isVerified && (
                            <SealCheck
                              weight="fill"
                              role="img"
                              aria-label={`${holding.symbol} is a verified token`}
                              className="size-3.5 shrink-0 text-success"
                            />
                          )}
                        </div>
                      </div>
                    </TableCell>

                    <TableCell className="min-w-0 overflow-hidden whitespace-nowrap p-3 py-2.5 align-middle">
                      <div className="flex flex-col items-start whitespace-nowrap">
                        <span className="whitespace-nowrap text-sm font-medium text-foreground">
                          {priceUnavailable
                            ? PRICE_UNAVAILABLE
                            : formatMainCurrency(holding.mainCurrencyValue, mainCurrency)}
                        </span>
                        <div className="text-xs text-muted-foreground">{balanceText}</div>
                      </div>
                    </TableCell>

                    <TableCell className="min-w-0 overflow-hidden whitespace-nowrap p-3 py-2.5 align-middle">
                      <div className="flex flex-col items-end whitespace-nowrap">
                        <span className="whitespace-nowrap text-sm font-medium text-foreground">
                          {priceUnavailable ? PRICE_UNAVAILABLE : formatUsd(holding.currentUsdPrice)}
                        </span>
                        {holding.priceChange24h === null ? (
                          <div className="text-xs text-muted-foreground">{EM_DASH}</div>
                        ) : (
                          <div className={`text-xs ${signClass(holding.priceChange24h)}`}>
                            {formatSignedPercent(holding.priceChange24h)}
                          </div>
                        )}
                      </div>
                    </TableCell>

                    <TableCell className="min-w-0 overflow-hidden whitespace-nowrap p-3 py-2.5 align-middle">
                      {pnl === undefined ? (
                        <div className="text-right text-sm text-muted-foreground">{EM_DASH}</div>
                      ) : (
                        <div className="flex flex-col items-end whitespace-nowrap">
                          <span
                            className={`whitespace-nowrap text-sm font-medium ${signClass(pnl.usd)}`}
                          >
                            {formatSignedUsd(pnl.usd)}
                          </span>
                          <div className={`text-xs ${signClass(pnl.percent)}`}>
                            {formatSignedPercent(pnl.percent)}
                          </div>
                        </div>
                      )}
                    </TableCell>

                    <TableCell className="min-w-0 overflow-hidden whitespace-nowrap p-3 py-2.5 text-right align-middle">
                      {holding.chain === 'solana' && (
                        <a
                          href={`https://jup.ag/tokens/${holding.tokenId}`}
                          target="_blank"
                          rel="noreferrer noopener"
                          className="inline-flex items-center rounded-full bg-muted px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-border"
                        >
                          Trade
                        </a>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </TableSection>
  )
}
