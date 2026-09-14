import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import App from './App'
import {
  demoWallets,
  demoHoldings,
  demoActivity,
  demoPnlDays,
} from './lib/fixtures/demoData'

vi.mock('./hooks/useWallets', () => ({
  useWallets: () => ({
    wallets: demoWallets,
    mainCurrency: 'SOL',
    isLoading: false,
    addWallet: vi.fn(),
    removeWallet: vi.fn(),
    relabelWallet: vi.fn(),
    setMainCurrency: vi.fn(),
  }),
}))

vi.mock('./hooks/useHoldings', () => ({
  useHoldings: () => ({
    holdings: demoHoldings,
    mainCurrency: 'SOL',
    isLoading: false,
    isFetching: false,
    isStale: false,
    error: null,
  }),
}))

vi.mock('./hooks/useActivity', () => ({
  useActivity: () => ({
    rows: demoActivity,
    mainCurrency: 'SOL',
    isLoading: false,
    isFetching: false,
    isStale: false,
    error: null,
  }),
}))

vi.mock('./hooks/usePnlCalendar', () => ({
  usePnlCalendar: () => ({
    days: demoPnlDays,
    mainCurrency: 'SOL',
    isLoading: false,
    isFetching: false,
    isStale: false,
    error: null,
  }),
}))

describe('App', () => {
  it('renders the tabs and a holdings row', () => {
    render(<App />)
    expect(screen.getByRole('tab', { name: 'Holdings' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Activity' })).toBeInTheDocument()
    expect(screen.getAllByText('SOL').length).toBeGreaterThan(0)
  })
})
