// Wallet add/remove/label manager — implemented in Phase 4/5, per ARCHITECTURE.md §6.
// Trigger keeps Jupiter's harvested account-chip anatomy (avatar + label +
// count pill + caret); the panel itself is built on the shared `Popover`
// primitive so it gets a proper near-fullscreen sheet on mobile instead of
// the old corner-anchored `absolute` box, and the same outside-click/Escape
// dismiss and entrance transition every other popover in the app now has.
import { useState } from 'react'
import type { FormEvent } from 'react'
import { CaretDown, PencilSimple, Trash } from '@phosphor-icons/react'
import { Popover } from '../ui/Popover'
import { TokenIcon } from '../ui/TokenIcon'
import type { ChainId } from '../../types/chain'
import type { WalletEntry } from '../../types/state'

interface WalletManagerProps {
  wallets: WalletEntry[]
  onAddWallet: (wallet: WalletEntry) => void
  onRemoveWallet: (chain: ChainId, address: string) => void
  onRelabelWallet: (chain: ChainId, address: string, label: string) => void
}

const INPUT_CLASSES =
  'rounded-lg bg-input px-2 py-1.5 text-sm text-foreground transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent'

function shortenAddress(address: string): string {
  return address.length <= 10 ? address : `${address.slice(0, 6)}…${address.slice(-4)}`
}

function walletId(chain: ChainId, address: string): string {
  return `${chain}:${address}`
}

export function WalletManager({
  wallets,
  onAddWallet,
  onRemoveWallet,
  onRelabelWallet,
}: WalletManagerProps) {
  const [open, setOpen] = useState(false)
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [newChain, setNewChain] = useState<ChainId>('solana')
  const [newAddress, setNewAddress] = useState('')
  // Included/excluded selection isn't part of WalletEntry yet, so this is
  // local-only UI state (all wallets start included, nothing persists).
  const [includedIds, setIncludedIds] = useState<Set<string>>(
    () => new Set(wallets.map((w) => walletId(w.chain, w.address))),
  )

  const toggleIncluded = (id: string) => {
    setIncludedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const startRename = (id: string, currentLabel: string) => {
    setRenamingId(id)
    setRenameValue(currentLabel)
  }

  const submitRename = (chain: ChainId, address: string) => {
    onRelabelWallet(chain, address, renameValue)
    setRenamingId(null)
  }

  const handleAddSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (newAddress.trim() === '') return
    onAddWallet({ chain: newChain, address: newAddress.trim() })
    setNewAddress('')
  }

  return (
    <Popover
      open={open}
      onClose={() => setOpen(false)}
      title="Wallets"
      trigger={
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="group/selector -ml-2 flex min-w-0 cursor-pointer flex-row items-center gap-2 rounded-xl px-2 py-1.5 pr-3 transition-colors duration-150 hover:bg-border/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:scale-[0.98]"
          aria-expanded={open}
        >
          <TokenIcon symbol="W" size={24} />
          <span className="truncate text-sm font-medium text-foreground">Wallets</span>
          <span className="inline-flex h-6 shrink-0 items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
            {wallets.length} wallet{wallets.length === 1 ? '' : 's'}
          </span>
          <CaretDown weight="bold" className="size-3.5 shrink-0 text-muted-foreground" />
        </button>
      }
    >
      <ul className="flex flex-col gap-1">
        {wallets.map((wallet) => {
          const id = walletId(wallet.chain, wallet.address)
          const isRenaming = renamingId === id
          return (
            <li
              key={id}
              className="flex items-center gap-2 rounded-xl px-2 py-1.5 transition-colors duration-150 hover:bg-muted/50"
            >
              <input
                type="checkbox"
                checked={includedIds.has(id)}
                onChange={() => toggleIncluded(id)}
                aria-label={`Include ${wallet.label ?? shortenAddress(wallet.address)}`}
                className="size-4 shrink-0 rounded border-border bg-input accent-accent transition-colors duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              />
              <TokenIcon symbol={wallet.label ?? wallet.address} size={24} />
              <div className="min-w-0 flex-1">
                {isRenaming ? (
                  <form
                    onSubmit={(event) => {
                      event.preventDefault()
                      submitRename(wallet.chain, wallet.address)
                    }}
                    className="flex items-center gap-1"
                  >
                    <input
                      autoFocus
                      value={renameValue}
                      onChange={(event) => setRenameValue(event.target.value)}
                      aria-label="Wallet label"
                      className={`w-full ${INPUT_CLASSES} px-1.5 py-0.5`}
                    />
                    <button
                      type="submit"
                      className="text-xs text-accent transition-colors duration-150 hover:text-accent/80"
                    >
                      Save
                    </button>
                  </form>
                ) : (
                  <>
                    <p className="truncate text-sm text-foreground">
                      {wallet.label ?? shortenAddress(wallet.address)}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {shortenAddress(wallet.address)}
                    </p>
                  </>
                )}
              </div>
              {!isRenaming && (
                <button
                  type="button"
                  onClick={() => startRename(id, wallet.label ?? '')}
                  aria-label={`Rename ${shortenAddress(wallet.address)}`}
                  className="shrink-0 rounded-lg p-1.5 text-muted-foreground transition-colors duration-150 hover:bg-muted hover:text-foreground focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  <PencilSimple weight="bold" className="size-4" />
                </button>
              )}
              <button
                type="button"
                onClick={() => onRemoveWallet(wallet.chain, wallet.address)}
                aria-label={`Remove ${shortenAddress(wallet.address)}`}
                className="shrink-0 rounded-lg p-1.5 text-muted-foreground transition-colors duration-150 hover:bg-destructive/10 hover:text-destructive focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                <Trash weight="bold" className="size-4" />
              </button>
            </li>
          )
        })}
      </ul>

      <form
        onSubmit={handleAddSubmit}
        className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3"
      >
        <select
          value={newChain}
          onChange={(event) => setNewChain(event.target.value as ChainId)}
          aria-label="Chain"
          className={INPUT_CLASSES}
        >
          <option value="solana">Solana</option>
          <option value="bsc">BSC</option>
        </select>
        <input
          value={newAddress}
          onChange={(event) => setNewAddress(event.target.value)}
          placeholder="Address"
          aria-label="Wallet address"
          className={`min-w-0 flex-1 ${INPUT_CLASSES}`}
        />
        <button
          type="submit"
          className="w-full shrink-0 rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-background transition-colors duration-150 hover:bg-accent/90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:scale-[0.98] sm:w-auto"
        >
          Add wallet
        </button>
      </form>
    </Popover>
  )
}
