import {
  ArrowClockwise,
  DownloadSimple,
} from '@phosphor-icons/react'
import type { ActivityLegRow, ActivityRow } from '../../hooks/useActivity'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '../ui/Table'
import { TableSection } from '../ui/TableSection'
import { Pill } from '../ui/Pill'
import { TokenIcon } from '../ui/TokenIcon'
import { Tooltip } from '../ui/Tooltip'
import { formatMainCurrency } from '../../lib/format/currency'
import { formatAmount } from '../../lib/format/number'

interface ActivityTableProps {
  rows: ActivityRow[]
  mainCurrency: string
  isFetching?: boolean
  onRefresh?: () => void
}

function utcDayKey(timestamp: number): string {
  return new Date(timestamp * 1000).toISOString().slice(0, 10)
}

function formatDayLabel(dayKey: string): string {
  return new Date(`${dayKey}T00:00:00Z`).toLocaleDateString(undefined, {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

function formatTime(timestamp: number): string {
  return new Date(timestamp * 1000).toLocaleTimeString(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'UTC',
    hour12: false,
  })
}

function shortenTxHash(txHash: string): string {
  return txHash.length <= 10 ? txHash : `${txHash.slice(0, 6)}…${txHash.slice(-4)}`
}

function explorerTxUrl(chain: ActivityRow['chain'], txHash: string): string {
  return chain === 'solana'
    ? `https://solscan.io/tx/${txHash}`
    : `https://bscscan.com/tx/${txHash}`
}

function formatLeg(leg: ActivityLegRow, mainCurrency: string): string {
  const sign = leg.direction === 'in' ? '+' : '-'
  const amount = formatAmount(leg.amount, { maxFractionDigits: 4 })
  const value = formatMainCurrency(leg.valueMainCurrency, mainCurrency)
  return `${sign}${amount} ${leg.symbol} (${value})`
}

function groupByUtcDay(rows: ActivityRow[]): [string, ActivityRow[]][] {
  const byDay = new Map<string, ActivityRow[]>()
  for (const row of rows) {
    const key = utcDayKey(row.timestamp)
    const existing = byDay.get(key)
    if (existing) existing.push(row)
    else byDay.set(key, [row])
  }
  return Array.from(byDay.entries()).sort((a, b) => (a[0] < b[0] ? 1 : -1))
}

function csvCell(value: string): string {
  return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

function legsToCsvField(legs: ActivityLegRow[], mainCurrency: string): string {
  return legs.map((leg) => formatLeg(leg, mainCurrency)).join('; ')
}

function activityToCsv(rows: ActivityRow[], mainCurrency: string): string {
  const header = ['Date', 'Time', 'Received', 'Sent', 'Tx']
  const lines = rows.map((row) => {
    const received = row.legs.filter((leg) => leg.direction === 'in')
    const sent = row.legs.filter((leg) => leg.direction === 'out')
    return [
      utcDayKey(row.timestamp),
      formatTime(row.timestamp),
      legsToCsvField(received, mainCurrency),
      legsToCsvField(sent, mainCurrency),
      row.txHash,
    ]
      .map(csvCell)
      .join(',')
  })
  return [header.join(','), ...lines].join('\n')
}

function downloadActivityCsv(rows: ActivityRow[], mainCurrency: string): void {
  const csv = activityToCsv(rows, mainCurrency)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `activity-${new Date().toISOString().slice(0, 10)}.csv`
  link.click()
  URL.revokeObjectURL(url)
}

export function ActivityTable({ rows, mainCurrency, isFetching = false, onRefresh }: ActivityTableProps) {
  const days = groupByUtcDay(rows)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          aria-label="Export CSV"
          disabled={rows.length === 0}
          onClick={() => downloadActivityCsv(rows, mainCurrency)}
          className="ml-auto flex items-center gap-1 rounded-full bg-border/70 px-2.5 py-1 text-xs text-foreground-secondary disabled:cursor-not-allowed disabled:opacity-50"
        >
          <DownloadSimple weight="bold" />
          Export
        </button>
        <button
          type="button"
          aria-label="Refresh"
          disabled={isFetching || !onRefresh}
          onClick={onRefresh}
          className="rounded-full bg-border/70 p-1.5 text-foreground-secondary disabled:cursor-not-allowed disabled:opacity-50"
        >
          <ArrowClockwise weight="bold" className={isFetching ? 'animate-spin' : undefined} />
        </button>
      </div>

      {rows.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">No activity yet</p>
      ) : (
        days.map(([dayKey, dayRows]) => (
          <TableSection
            key={dayKey}
            title={formatDayLabel(dayKey)}
            badge={<Pill>{`${dayRows.length} activities`}</Pill>}
          >
            <div className="relative w-full overflow-x-auto overflow-y-hidden overscroll-x-contain">
              <Table className="table-fixed caption-bottom text-sm max-sm:min-w-max">
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-24 p-3">Time</TableHead>
                    <TableHead className="w-28 p-3">App</TableHead>
                    <TableHead className="w-[180px] p-3">Received</TableHead>
                    <TableHead className="w-[180px] p-3">Sent</TableHead>
                    <TableHead className="w-24 p-3">Tags</TableHead>
                    <TableHead className="w-24 p-3">Tx</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dayRows.map((row) => {
                    const received = row.legs.filter((leg) => leg.direction === 'in')
                    const sent = row.legs.filter((leg) => leg.direction === 'out')
                    return (
                      <TableRow
                        key={row.txHash}
                        className="hover:bg-muted/30 transition-colors duration-150"
                      >
                        <TableCell className="w-24 p-3 py-2.5 align-middle text-sm text-muted-foreground">
                          {formatTime(row.timestamp)}
                        </TableCell>
                        {/* No protocol/app name+logo field in ActivityRow yet */}
                        <TableCell className="w-28 p-3 py-2.5 align-middle text-sm text-muted-foreground">
                          --
                        </TableCell>
                        <TableCell className="w-[180px] p-3 py-2.5 align-middle">
                          <div className="flex flex-col gap-1">
                            {received.map((leg, i) => (
                              <div key={i} className="flex items-center gap-1.5 text-sm text-success">
                                <Tooltip content={leg.name}>
                                  <TokenIcon symbol={leg.symbol} iconUrl={leg.iconUrl} size={16} />
                                </Tooltip>
                                <span className="truncate text-success">{formatLeg(leg, mainCurrency)}</span>
                              </div>
                            ))}
                          </div>
                        </TableCell>
                        <TableCell className="w-[180px] p-3 py-2.5 align-middle">
                          <div className="flex flex-col gap-1">
                            {sent.map((leg, i) => (
                              <div key={i} className="flex items-center gap-1.5 text-sm text-destructive">
                                <Tooltip content={leg.name}>
                                  <TokenIcon symbol={leg.symbol} iconUrl={leg.iconUrl} size={16} />
                                </Tooltip>
                                <span className="truncate text-destructive">{formatLeg(leg, mainCurrency)}</span>
                              </div>
                            ))}
                          </div>
                        </TableCell>
                        {/* Tags column kept for layout parity — no tag data (Failed/Spam) in the model yet */}
                        <TableCell className="w-24 p-3 py-2.5 align-middle" />
                        <TableCell className="w-24 p-3 py-2.5 align-middle whitespace-nowrap text-sm tabular-nums text-muted-foreground">
                          <a
                            href={explorerTxUrl(row.chain, row.txHash)}
                            target="_blank"
                            rel="noreferrer noopener"
                            className="text-muted-foreground transition-colors hover:text-foreground"
                          >
                            {shortenTxHash(row.txHash)}
                          </a>
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            </div>
          </TableSection>
        ))
      )}

      {/* §6 calls for infinite scroll (5 pages) then "Load More" — useActivity
          has no pagination cursor yet (it fetches one fixed-size page per
          wallet), so this is a static affordance with nothing further to
          load until that hook grows pagination support in a later phase. */}
      {rows.length > 0 && (
        <button
          type="button"
          disabled
          className="self-center rounded-full bg-border/70 px-3 py-1.5 text-xs text-foreground-faint disabled:cursor-not-allowed"
        >
          Load More
        </button>
      )}
    </div>
  )
}
