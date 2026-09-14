// Wallet add/remove/label manager — implemented in Phase 4/5, per ARCHITECTURE.md §6.
import { useState } from 'react'
import type { FormEvent } from 'react'
import { CaretDown, PencilSimple, Trash, X } from '@phosphor-icons/react'
import { Pill } from '../ui/Pill'
import type { ChainId } from '../../types/chain'
import type { WalletEntry } from '../../types/state'

interface WalletManagerProps {
  wallets: WalletEntry[]
  onAddWallet: (wallet: WalletEntry) => void
  onRemoveWallet: (chain: ChainId, address: string) => void
  onRelabelWallet: (chain: ChainId, address: string, label: string) => void
}

function shortenAddress(address: string): string {
  return address.length <= 10 ? address : `${address.slice(0, 6)}…${address.slice(-4)}`
}

function walletId(chain: ChainId, address: string): string {
  return `${chain}:${address}`
}

export function WalletManager({ wallets, onAddWallet, onRemoveWallet, onRelabelWallet }: WalletManagerProps) {
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
    <div className="relative inline-block">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-full bg-input px-2 py-1.5 pr-3 text-sm text-foreground hover:bg-muted/50"
        aria-expanded={open}
      >
        <span className="h-6 w-6 rounded-full bg-border" aria-hidden="true" />
        <Pill variant="default">{wallets.length} wallets</Pill>
        <CaretDown weight="bold" className="size-3.5 text-muted-foreground" />
      </button>

      {open && (
        <div className="absolute left-0 z-40 mt-2 w-80 rounded-2xl bg-card p-3 shadow-lg">
          <ul className="flex flex-col gap-1">
            {wallets.map((wallet) => {
              const id = walletId(wallet.chain, wallet.address)
              const isRenaming = renamingId === id
              return (
                <li
                  key={id}
                  className="flex items-center gap-2 rounded-xl px-2 py-1.5 hover:bg-muted/50"
                >
                  <input
                    type="checkbox"
                    checked={includedIds.has(id)}
                    onChange={() => toggleIncluded(id)}
                    aria-label={`Include ${wallet.label ?? shortenAddress(wallet.address)}`}
                  />
                  <span className="h-6 w-6 shrink-0 rounded-full bg-border" aria-hidden="true" />
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
                          className="w-full rounded bg-input px-1.5 py-0.5 text-sm text-foreground"
                        />
                        <button type="submit" className="text-xs text-accent">
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
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <PencilSimple weight="bold" className="size-4" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onRemoveWallet(wallet.chain, wallet.address)}
                    aria-label={`Remove ${shortenAddress(wallet.address)}`}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash weight="bold" className="size-4" />
                  </button>
                </li>
              )
            })}
          </ul>

          <form onSubmit={handleAddSubmit} className="mt-3 flex items-center gap-2 border-t border-border pt-3">
            <select
              value={newChain}
              onChange={(event) => setNewChain(event.target.value as ChainId)}
              aria-label="Chain"
              className="rounded-lg bg-input px-2 py-1.5 text-sm text-foreground"
            >
              <option value="solana">Solana</option>
              <option value="bsc">BSC</option>
            </select>
            <input
              value={newAddress}
              onChange={(event) => setNewAddress(event.target.value)}
              placeholder="Address"
              aria-label="Wallet address"
              className="min-w-0 flex-1 rounded-lg bg-input px-2 py-1.5 text-sm text-foreground"
            />
            <button
              type="submit"
              className="shrink-0 rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-background"
            >
              Add wallet
            </button>
          </form>

          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close"
            className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
          >
            <X weight="bold" className="size-4" />
          </button>
        </div>
      )}
    </div>
  )
}
