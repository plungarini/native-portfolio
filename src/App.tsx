import { useMemo, useState } from 'react'
import { Tabs } from './components/Tabs'
import { HoldingsTable } from './components/HoldingsTable'
import { AllocationBreakdown } from './components/AllocationBreakdown'
import { CurrencySwitcher } from './components/CurrencySwitcher'
import { WalletManager } from './components/WalletManager'
import { ActivityTable } from './components/ActivityTable'
import { PnlCalendar } from './components/PnlCalendar'
import { NetWorthCard } from './components/NetWorthCard'
import { SpotPnlCard } from './components/SpotPnlCard'
import { TransferSummaryCard } from './components/TransferSummaryCard'
import { CollapsibleSection } from './components/ui/CollapsibleSection'
import { Skeleton } from './components/ui/Skeleton'
import { Badge } from './components/ui/Badge'
import { useWallets } from './hooks/useWallets'
import { useHoldings } from './hooks/useHoldings'
import { useActivity } from './hooks/useActivity'
import { usePnlCalendar } from './hooks/usePnlCalendar'
import { usePerTokenPnl } from './hooks/usePerTokenPnl'
import { SUPPORTED_CURRENCIES } from './config/currencies'
import type { Holding } from './hooks/useHoldings'
import type { PnlCalendarDay } from './hooks/usePnlCalendar'

const TABS = [
  { key: 'holdings', label: 'Holdings' },
  { key: 'activity', label: 'Activity' },
]

const CURRENCY_OPTIONS = SUPPORTED_CURRENCIES.map((c) => c.symbol)

function StaleBadge() {
  return <Badge variant="muted">stale</Badge>
}

function sumValues(holdings: Holding[], pick: (h: Holding) => number | null): number | null {
  let total = 0
  let sawValue = false
  for (const holding of holdings) {
    const value = pick(holding)
    if (value !== null && Number.isFinite(value)) {
      total += value
      sawValue = true
    }
  }
  return sawValue ? total : null
}

/** Yesterday's USD total, reconstructed per holding from its own 24h change:
 * `value / (1 + pct/100)`. Holdings with no 24h data are carried at today's
 * value, so they contribute nothing to the delta rather than skewing it. */
function previousUsdTotal(holdings: Holding[]): number | null {
  let total = 0
  let sawValue = false
  for (const holding of holdings) {
    if (holding.usdValue === null || !Number.isFinite(holding.usdValue)) continue
    sawValue = true
    const pct = holding.priceChange24h
    const factor = pct === null ? 1 : 1 + pct / 100
    total += factor > 0 ? holding.usdValue / factor : holding.usdValue
  }
  return sawValue ? total : null
}

/** Running cumulative PnL, oldest to newest — the series behind the card's
 * sparkline. This is realized PnL over time, not a reconstructed net-worth
 * history (that would need historical balances we don't fetch). */
function cumulativePnlSeries(days: PnlCalendarDay[]): number[] {
  const chronological = [...days].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
  let running = 0
  return chronological.map((day) => {
    running += day.pnlUsd
    return running
  })
}

function App() {
  const [activeTab, setActiveTab] = useState('holdings')
  const [calendarOpen, setCalendarOpen] = useState(false)

  const {
    wallets,
    mainCurrency,
    isLoading: walletsLoading,
    addWallet,
    removeWallet,
    relabelWallet,
    setMainCurrency,
  } = useWallets()

  const holdings = useHoldings()
  const activity = useActivity()
  const pnlCalendar = usePnlCalendar()
  const perTokenPnl = usePerTokenPnl()

  const hasWallets = wallets.length > 0

  const totals = useMemo(() => {
    const rows = holdings.holdings
    const usd = sumValues(rows, (h) => h.usdValue)
    const main = sumValues(rows, (h) => h.mainCurrencyValue)
    const previous = previousUsdTotal(rows)
    const changeUsd = usd !== null && previous !== null ? usd - previous : null
    const changePercent =
      changeUsd !== null && previous !== null && previous !== 0
        ? (changeUsd / previous) * 100
        : null
    return { usd, main, changeUsd, changePercent }
  }, [holdings.holdings])

  const series = useMemo(() => cumulativePnlSeries(pnlCalendar.days), [pnlCalendar.days])

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex w-full max-w-[calc(1112px+4rem)] flex-col gap-6 px-5 pt-5 pb-28 sm:pb-20">
        <header className="flex flex-row flex-wrap items-center justify-between gap-x-4 gap-y-3">
          <div className="flex shrink-0 items-center gap-4">
            <WalletManager
              wallets={wallets}
              onAddWallet={addWallet}
              onRemoveWallet={removeWallet}
              onRelabelWallet={relabelWallet}
            />
          </div>
          <div className="flex min-w-0 max-w-full items-center gap-2">
            {(holdings.isStale || activity.isStale) && <StaleBadge />}
            <CurrencySwitcher
              value={mainCurrency}
              onChange={setMainCurrency}
              options={CURRENCY_OPTIONS}
            />
          </div>
        </header>

        <Tabs tabs={TABS} activeKey={activeTab} onChange={setActiveTab} />

        {walletsLoading ? (
          <Skeleton className="h-64 w-full" />
        ) : !hasWallets ? (
          <div className="flex flex-col items-center gap-4 rounded-2xl border border-foreground/[0.03] bg-card px-6 py-12 text-center">
            <h2 className="text-lg font-medium text-foreground">Add a wallet to get started</h2>
            <p className="max-w-sm text-sm text-muted-foreground">
              Track holdings, activity, and PnL by adding a Solana or BSC wallet address.
            </p>
            <WalletManager
              wallets={wallets}
              onAddWallet={addWallet}
              onRemoveWallet={removeWallet}
              onRelabelWallet={relabelWallet}
            />
          </div>
        ) : activeTab === 'holdings' ? (
          <div className="flex flex-col gap-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <NetWorthCard
                totalUsd={totals.usd}
                mainCurrencyTotal={totals.main}
                mainCurrency={mainCurrency}
                changeUsd={totals.changeUsd}
                changePercent={totals.changePercent}
                series={series}
              />
              <SpotPnlCard
                days={pnlCalendar.days}
                mainCurrency={mainCurrency}
                onOpenCalendar={() => setCalendarOpen(true)}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <TransferSummaryCard
                transfers={activity.transfers}
                direction="deposit"
                mainCurrency={mainCurrency}
              />
              <TransferSummaryCard
                transfers={activity.transfers}
                direction="withdrawal"
                mainCurrency={mainCurrency}
              />
            </div>

            {holdings.isLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : (
              <>
                <CollapsibleSection
                  title="Allocation"
                  value={`${holdings.holdings.length} tokens`}
                  size="sm"
                  defaultOpen={false}
                >
                  <div className="px-3 py-3">
                    <AllocationBreakdown holdings={holdings.holdings} />
                  </div>
                </CollapsibleSection>
                <HoldingsTable
                  holdings={holdings.holdings}
                  mainCurrency={mainCurrency}
                  pnlByKey={perTokenPnl.pnlByKey}
                />
              </>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {activity.isLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : (
              <ActivityTable
                rows={activity.rows}
                mainCurrency={mainCurrency}
                isFetching={activity.isFetching}
                onRefresh={activity.refetch}
              />
            )}
          </div>
        )}

        <PnlCalendar
          days={pnlCalendar.days}
          mainCurrency={mainCurrency}
          open={calendarOpen}
          onOpenChange={setCalendarOpen}
        />
      </div>
    </div>
  )
}

export default App
