// Supported main-currency dictionary — implemented in Phase 3/5, per ARCHITECTURE.md §4/§7.
//
// Maps a `mainCurrency` symbol (as stored in `AppState.mainCurrency`, per
// §4) to the identifiers needed to price it, per §3.3:
//   - `coinId`: DefiLlama "coin key" (`coingecko:<slug>` for a native asset,
//     `{chain}:{contractAddress}` for a token) used for historical lookups
//     and as the current-price fallback.
//   - `solanaMint`: when the currency also exists as an SPL mint, Jupiter
//     Price v3 is preferred for *current* pricing (§3.3), batched together
//     with the wallet's other Solana holdings in the same request.
//
// `USD` is a special case: it is priced at a fixed `1` rather than through
// either price API, since it's the USD bridge currency itself (§5).

export interface CurrencyConfig {
  symbol: string
  name: string
  /** DefiLlama coin key, per §3.3. Absent only for the fixed `USD` case. */
  coinId?: string
  /** SPL mint address, when this currency is also a Solana token — enables
   * current-price lookups via Jupiter Price v3 (§3.3). */
  solanaMint?: string
}

export const SUPPORTED_CURRENCIES: CurrencyConfig[] = [
  {
    symbol: 'SOL',
    name: 'Solana',
    coinId: 'coingecko:solana',
    solanaMint: 'So11111111111111111111111111111111111111112',
  },
  {
    symbol: 'BNB',
    name: 'BNB',
    coinId: 'coingecko:binancecoin',
  },
  {
    symbol: 'USDC',
    name: 'USD Coin',
    coinId: 'coingecko:usd-coin',
    solanaMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  },
  {
    symbol: 'USDT',
    name: 'Tether USD',
    coinId: 'coingecko:tether',
    solanaMint: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
  },
  {
    symbol: 'BTC',
    name: 'Bitcoin',
    coinId: 'coingecko:bitcoin',
  },
  {
    symbol: 'ETH',
    name: 'Ethereum',
    coinId: 'coingecko:ethereum',
  },
  {
    symbol: 'USD',
    name: 'US Dollar',
  },
  {
    symbol: 'EUR',
    name: 'Euro',
    coinId: 'coingecko:eur',
  },
  {
    symbol: 'GBP',
    name: 'British Pound',
    coinId: 'coingecko:gbp',
  },
]

export const DEFAULT_MAIN_CURRENCY = 'SOL'

/** A currency priced at a fixed `1` rather than via a live price API (§5). */
export const FIXED_UNIT_CURRENCIES = new Set(['USD'])

export function getCurrencyConfig(symbol: string): CurrencyConfig | undefined {
  const upper = symbol.toUpperCase()
  return SUPPORTED_CURRENCIES.find((c) => c.symbol === upper)
}
