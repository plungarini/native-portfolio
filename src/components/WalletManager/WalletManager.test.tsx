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

  it('trigger uses the Jupiter account-chip recipe with a hover/focus-visible state', () => {
    render(
      <WalletManager
        wallets={demoWallets}
        onAddWallet={vi.fn()}
        onRemoveWallet={vi.fn()}
        onRelabelWallet={vi.fn()}
      />,
    )
    const trigger = screen.getByText(`${demoWallets.length} wallets`).closest('button')
    expect(trigger).not.toBeNull()
    expect(trigger).toHaveClass('rounded-xl')
    expect(trigger).toHaveClass('hover:bg-border/70')
    expect(trigger).toHaveClass('transition-colors')
    expect(trigger).toHaveClass('focus-visible:outline')
  })

  it('the count badge renders as a pill (rounded-full bg-muted)', () => {
    render(
      <WalletManager
        wallets={demoWallets}
        onAddWallet={vi.fn()}
        onRemoveWallet={vi.fn()}
        onRelabelWallet={vi.fn()}
      />,
    )
    const badge = screen.getByText(`${demoWallets.length} wallets`)
    expect(badge).toHaveClass('rounded-full')
    expect(badge).toHaveClass('bg-muted')
  })

  it('popover panel renders using the Card primitive (rounded-2xl border bg-card)', () => {
    render(
      <WalletManager
        wallets={demoWallets}
        onAddWallet={vi.fn()}
        onRemoveWallet={vi.fn()}
        onRelabelWallet={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByText(`${demoWallets.length} wallets`))
    const panel = screen.getByLabelText('Close').closest('div.relative.flex.flex-col')
    expect(panel).not.toBeNull()
    expect(panel).toHaveClass('rounded-2xl')
    expect(panel).toHaveClass('border-foreground/[0.03]')
    expect(panel).toHaveClass('bg-card')
  })

  it('row action buttons (rename, remove) have a transition-colors hover state', () => {
    render(
      <WalletManager
        wallets={demoWallets}
        onAddWallet={vi.fn()}
        onRemoveWallet={vi.fn()}
        onRelabelWallet={vi.fn()}
      />,
    )
    fireEvent.click(screen.getByText(`${demoWallets.length} wallets`))
    const wallet = demoWallets[0]
    const renameButton = screen.getByLabelText(`Rename ${wallet.address.slice(0, 6)}…${wallet.address.slice(-4)}`)
    const removeButton = screen.getByLabelText(`Remove ${wallet.address.slice(0, 6)}…${wallet.address.slice(-4)}`)
    expect(renameButton).toHaveClass('transition-colors')
    expect(renameButton).toHaveClass('hover:bg-muted')
    expect(removeButton).toHaveClass('transition-colors')
    expect(removeButton).toHaveClass('hover:bg-destructive/10')
  })

  it('closes on Escape and on a pointerdown outside the popover', () => {
    render(
      <div>
        <button type="button">Outside</button>
        <WalletManager
          wallets={demoWallets}
          onAddWallet={vi.fn()}
          onRemoveWallet={vi.fn()}
          onRelabelWallet={vi.fn()}
        />
      </div>,
    )
    fireEvent.click(screen.getByText(`${demoWallets.length} wallets`))
    expect(screen.getByLabelText('Close')).toBeInTheDocument()

    fireEvent.keyDown(document, { key: 'Escape' })
    expect(screen.queryByLabelText('Close')).not.toBeInTheDocument()

    fireEvent.click(screen.getByText(`${demoWallets.length} wallets`))
    expect(screen.getByLabelText('Close')).toBeInTheDocument()

    fireEvent.pointerDown(screen.getByText('Outside'))
    expect(screen.queryByLabelText('Close')).not.toBeInTheDocument()
  })
})
