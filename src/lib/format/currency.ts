// Currency formatting helpers (main-currency + USD display) — implemented in Phase 5, per ARCHITECTURE.md §5.1.
import { formatAmount } from './number'

/** Literal text shown wherever a price/value is `null` — per §5.3's hard rule,
 * a missing price is never silently blanked or substituted, only labeled. */
export const PRICE_UNAVAILABLE = 'price unavailable'

/**
 * Formats a USD value with Intl currency formatting. `null` (price/value
 * unavailable, e.g. no current price for a token) renders as the literal
 * "price unavailable" string rather than an empty string or "$0".
 */
export function formatUsd(value: number | null): string {
  if (value === null) return PRICE_UNAVAILABLE
  return value.toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  })
}

/**
 * Same as `formatUsd`, but prefixes a literal "+" for positive values (USD
 * never gets a forced sign otherwise). Used for PnL calendar cells and other
 * signed USD figures per §5.2. `null` still renders as "price unavailable".
 */
export function formatSignedUsd(value: number | null): string {
  if (value === null) return PRICE_UNAVAILABLE
  const sign = value > 0 ? '+' : ''
  return `${sign}${formatUsd(value)}`
}

/**
 * Formats an amount denominated in the user's chosen main currency (e.g.
 * SOL), appending its symbol — per §5.1's `display(h)` / §5.2's `cell.big`.
 * `null` (e.g. main-currency value could not be computed because a needed
 * price was unavailable) renders as "price unavailable", never a blank
 * amount with the symbol still attached.
 */
export function formatMainCurrency(value: number | null, symbol: string): string {
  if (value === null) return PRICE_UNAVAILABLE
  return `${formatAmount(value)} ${symbol}`
}

/**
 * Same as `formatMainCurrency`, but prefixes a literal "+" for positive
 * values — for signed main-currency figures such as §5.2's `cell.big`
 * (e.g. "+1.2 SOL").
 */
export function formatSignedMainCurrency(value: number | null, symbol: string): string {
  if (value === null) return PRICE_UNAVAILABLE
  const sign = value > 0 ? '+' : ''
  return `${sign}${formatAmount(value)} ${symbol}`
}

/**
 * Full holdings display string per §5.1:
 * `${format(mainCurrencyValue)} ${symbol} (~$${format(usdValue)})`
 * e.g. "12.4 SOL (~$1,860)". Either value being `null` still renders that
 * half literally as "price unavailable" rather than dropping it.
 */
export function formatHoldingValue(
  mainCurrencyValue: number | null,
  usdValue: number | null,
  symbol: string,
): string {
  const main = formatMainCurrency(mainCurrencyValue, symbol)
  const usd = usdValue === null ? PRICE_UNAVAILABLE : `~$${formatAmount(usdValue, { maxFractionDigits: 2 })}`
  return `${main} (${usd})`
}
