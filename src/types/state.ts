// AppState/WalletEntry shape — implemented in Phase 2, per ARCHITECTURE.md §4.

import type { ChainId } from './chain'

export interface WalletEntry {
  chain: ChainId
  /** base58 (solana) or 0x-hex (bsc) in the decoded, in-memory shape */
  address: string
  /** optional user-given nickname */
  label?: string
}

export interface AppState {
  /** schema version byte, for forward migrations */
  version: number
  /** e.g. "SOL" | "BNB" | "USDC" | "USD" ... */
  mainCurrency: string
  wallets: WalletEntry[]
}
