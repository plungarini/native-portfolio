import { useState } from 'react'
import { Tabs } from './components/Tabs'
import { HoldingsTable } from './components/HoldingsTable'
import { AllocationBreakdown } from './components/AllocationBreakdown'
import { CurrencySwitcher } from './components/CurrencySwitcher'
import { WalletManager } from './components/WalletManager'
import { ActivityTable } from './components/ActivityTable'
import { PnlCalendar } from './components/PnlCalendar'
import { demoHoldings, demoActivity, demoPnlDays, demoWallets } from './lib/fixtures/demoData'
import type { WalletEntry } from './types/state'
import type { ChainId } from './types/chain'

const TABS = [
  { key: 'holdings', label: 'Holdings' },
  { key: 'activity', label: 'Activity' },
]

const CURRENCY_OPTIONS = ['USD', 'SOL', 'BNB']

function App() {
  const [activeTab, setActiveTab] = useState('holdings')
  const [mainCurrency, setMainCurrency] = useState('USD')
  const [wallets, setWallets] = useState<WalletEntry[]>(demoWallets)

  const handleAddWallet = (wallet: WalletEntry) => {
    setWallets((prev) => [...prev, wallet])
  }

  const handleRemoveWallet = (chain: ChainId, address: string) => {
    setWallets((prev) => prev.filter((w) => !(w.chain === chain && w.address === address)))
  }

  const handleRelabelWallet = (chain: ChainId, address: string, label: string) => {
    setWallets((prev) =>
      prev.map((w) => (w.chain === chain && w.address === address ? { ...w, label } : w)),
    )
  }

  return (
    <div className="bg-background text-foreground min-h-screen px-4 py-8 sm:px-8">
      <div className="mx-auto flex max-w-4xl flex-col gap-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Tabs tabs={TABS} activeKey={activeTab} onChange={setActiveTab} />
          <div className="flex items-center gap-3">
            <PnlCalendar days={demoPnlDays} mainCurrency={mainCurrency} />
            <CurrencySwitcher value={mainCurrency} onChange={setMainCurrency} options={CURRENCY_OPTIONS} />
            <WalletManager
              wallets={wallets}
              onAddWallet={handleAddWallet}
              onRemoveWallet={handleRemoveWallet}
              onRelabelWallet={handleRelabelWallet}
            />
          </div>
        </div>

        {activeTab === 'holdings' ? (
          <div className="flex flex-col gap-6">
            <AllocationBreakdown holdings={demoHoldings} />
            <HoldingsTable holdings={demoHoldings} mainCurrency={mainCurrency} />
          </div>
        ) : (
          <ActivityTable rows={demoActivity} mainCurrency={mainCurrency} />
        )}
      </div>
    </div>
  )
}

export default App
