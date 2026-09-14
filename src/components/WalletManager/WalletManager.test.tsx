import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { WalletManager } from './index'
import { demoWallets } from '../../lib/fixtures/demoData'

afterEach(cleanup)

describe('WalletManager', () => {
  it('renders the "N wallets" chip with correct count', () => {
    render(
      <WalletManager
        wallets={demoWallets}
        onAddWallet={vi.fn()}
        onRemoveWallet={vi.fn()}
        onRelabelWallet={vi.fn()}
      />,
    )
    expect(screen.getByText(`${demoWallets.length} wallets`)).toBeInTheDocument()
  })

  it('opening the trigger reveals the wallet list', () => {
    render(
      <WalletManager
        wallets={demoWallets}
        onAddWallet={vi.fn()}
        onRemoveWallet={vi.fn()}
        onRelabelWallet={vi.fn()}
      />,
    )
    expect(screen.queryByText(demoWallets[0].label as string)).not.toBeInTheDocument()
    fireEvent.click(screen.getByText(`${demoWallets.length} wallets`))
    expect(screen.getByText(demoWallets[0].label as string)).toBeInTheDocument()
  })

  it('clicking a wallet remove button calls onRemoveWallet with its chain+address', () => {
    const onRemoveWallet = vi.fn()
    render(
      <WalletManager
        wallets={demoWallets}
        onAddWallet={vi.fn()}
        onRemoveWallet={onRemoveWallet}
        onRelabelWallet={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByText(`${demoWallets.length} wallets`))
    const wallet = demoWallets[0]
    fireEvent.click(screen.getByLabelText(`Remove ${wallet.address.slice(0, 6)}…${wallet.address.slice(-4)}`))
    expect(onRemoveWallet).toHaveBeenCalledWith(wallet.chain, wallet.address)
  })

  it('submitting the add-wallet form calls onAddWallet', () => {
    const onAddWallet = vi.fn()
    render(
      <WalletManager
        wallets={demoWallets}
        onAddWallet={onAddWallet}
        onRemoveWallet={vi.fn()}
        onRelabelWallet={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByText(`${demoWallets.length} wallets`))
    fireEvent.change(screen.getByLabelText('Wallet address'), { target: { value: 'abc123' } })
    fireEvent.click(screen.getByText('Add wallet'))
    expect(onAddWallet).toHaveBeenCalledWith({ chain: 'solana', address: 'abc123' })
  })
})
