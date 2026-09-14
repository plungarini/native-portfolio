// Per-chain config (RPC endpoint lists, bscKnownTokens, etc.) — implemented in Phase 3, per ARCHITECTURE.md §3.1/§3.2/§7.

/** A curated BEP-20 token entry (see `bscKnownTokens` below). */
export interface KnownToken {
  symbol: string
  name: string
  /** 0x-prefixed, lowercase 20-byte contract address. */
  address: string
  decimals: number
}

/**
 * Public BSC JSON-RPC hosts, in priority order. `bscRpcClient` round-robins
 * to the next entry in this list on a network error or an HTTP 429/5xx
 * response from the current host, per ARCHITECTURE.md §3.2.
 */
export const bscRpcHosts: string[] = [
  'https://bsc-rpc.publicnode.com',
  'https://bsc-dataseed.binance.org',
  'https://bsc-dataseed1.defibit.io',
  'https://bsc-dataseed1.ninicoin.io',
]

/**
 * Multicall3 — the same address on essentially every EVM chain, including
 * BSC. Used to batch `balanceOf` calls across `bscKnownTokens` into a
 * single `eth_call`, per ARCHITECTURE.md §3.2.
 */
export const bscMulticall3Address = '0xcA11bde05977b3631167028862bE2a173976CA11'

/**
 * Curated list of well-known BEP-20 tokens. There is no free "list every
 * token this wallet holds" indexer endpoint for BSC, so balances can only
 * ever be shown for tokens on this list (plus anything a user explicitly
 * adds by contract address via the UI's "add custom token" affordance) —
 * a real coverage limitation vs. Solana's DAS-style full enumeration, see
 * ARCHITECTURE.md §3.2/§10.
 */
export const bscKnownTokens: KnownToken[] = [
  {
    symbol: 'WBNB',
    name: 'Wrapped BNB',
    address: '0xbb4cdb9cbd36b01bd1cbaebf2de08d9173bc095c',
    decimals: 18,
  },
  {
    symbol: 'BUSD',
    name: 'Binance USD',
    address: '0xe9e7cea3dedca5984780bafc599bd69add087d56',
    decimals: 18,
  },
  {
    symbol: 'USDT',
    name: 'Tether USD',
    address: '0x55d398326f99059ff775485246999027b3197955',
    decimals: 18,
  },
  {
    symbol: 'USDC',
    name: 'USD Coin',
    address: '0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d',
    decimals: 18,
  },
  {
    symbol: 'CAKE',
    name: 'PancakeSwap Token',
    address: '0x0e09fabb73bd3ade0a17ecc321fd13a19e81ce82',
    decimals: 18,
  },
  {
    symbol: 'ETH',
    name: 'Binance-Peg Ethereum Token',
    address: '0x2170ed0880ac9a755fd29b2688956bd959f933f8',
    decimals: 18,
  },
  {
    symbol: 'BTCB',
    name: 'Binance-Peg BTCB Token',
    address: '0x7130d2a12b9bcbfae4f2634d864a1ee1ce3ead9c',
    decimals: 18,
  },
  {
    symbol: 'DAI',
    name: 'Dai Token',
    address: '0x1af3f329e8be154074d8769d1ffa4ee058b1dbc3',
    decimals: 18,
  },
  {
    symbol: 'XRP',
    name: 'XRP Token',
    address: '0x1d2f0da169ceb9fc7b3144628db156f3f6c60dbe',
    decimals: 18,
  },
  {
    symbol: 'DOGE',
    name: 'Dogecoin',
    // Binance-Peg DOGE keeps native Dogecoin's 8-decimal precision, unlike
    // most other Binance-Peg tokens which use 18 — a deliberate exception.
    address: '0xba2ae424d960c26247dd6c32edc70b295c744c43',
    decimals: 8,
  },
  {
    symbol: 'ADA',
    name: 'Cardano Token',
    address: '0x3ee2200efb3400fabb9aacf31297cbdd1d435d47',
    decimals: 18,
  },
]
