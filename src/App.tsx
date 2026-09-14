import { useState } from 'react'
import { Tabs } from './components/Tabs'
import { HoldingsTable } from './components/HoldingsTable'
import { AllocationBreakdown } from './components/AllocationBreakdown'
import { CurrencySwitcher } from './components/CurrencySwitcher'
import { WalletManager } from './components/WalletManager'
import { ActivityTable } from './components/ActivityTable'
import { PnlCalendar } from './components/PnlCalendar'
import { Skeleton } from './components/ui/Skeleton'
import { Badge } from './components/ui/Badge'
import { useWallets } from './hooks/useWallets'
import { useHoldings } from './hooks/useHoldings'
import { useActivity } from './hooks/useActivity'
import { usePnlCalendar } from './hooks/usePnlCalendar'
import { SUPPORTED_CURRENCIES } from './config/currencies'

const TABS = [
  { key: 'holdings', label: 'Holdings' },
  { key: 'activity', label: 'Activity' },
]

const CURRENCY_OPTIONS = SUPPORTED_CURRENCIES.map((c) => c.symbol)

function StaleBadge() {
  return <Badge variant="muted">stale</Badge>
}

function App() {
  const [activeTab, setActiveTab] = useState('holdings')

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

  const hasWallets = wallets.length > 0

  return (
    <div className="bg-background text-foreground min-h-screen px-4 py-8 sm:px-8">
      <div className="mx-auto flex max-w-4xl flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Tabs tabs={TABS} activeKey={activeTab} onChange={setActiveTab} />
          <div className="flex items-center gap-3">
            {pnlCalendar.isStale && <StaleBadge />}
            <PnlCalendar days={pnlCalendar.days} mainCurrency={mainCurrency} />
            <CurrencySwitcher value={mainCurrency} onChange={setMainCurrency} options={CURRENCY_OPTIONS} />
            <WalletManager
              wallets={wallets}
              onAddWallet={addWallet}
              onRemoveWallet={removeWallet}
              onRelabelWallet={relabelWallet}
            />
          </div>
        </div>

        {walletsLoading ? (
          <Skeleton className="h-64 w-full" />
        ) : !hasWallets ? (
          <div className="flex flex-col items-center gap-4 rounded-2xl border border-border bg-card px-6 py-12 text-center">
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
            {holdings.isStale && <StaleBadge />}
            {holdings.isLoading ? (
              <>
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-64 w-full" />
              </>
            ) : (
              <>
                <AllocationBreakdown holdings={holdings.holdings} />
                <HoldingsTable holdings={holdings.holdings} mainCurrency={mainCurrency} />
              </>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {activity.isStale && <StaleBadge />}
            {activity.isLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : (
              <ActivityTable rows={activity.rows} mainCurrency={mainCurrency} />
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default App
