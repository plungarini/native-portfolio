// Generic number formatting helpers — implemented in Phase 5, per ARCHITECTURE.md §5.

export interface FormatAmountOptions {
  /** Minimum fraction digits to show (default 0 — trailing zeros are trimmed). */
  minFractionDigits?: number
  /** Maximum fraction digits to show (default 6). */
  maxFractionDigits?: number
}

/**
 * Formats a plain token/amount number for display: locale thousands separators,
 * trailing zeros trimmed, with enough precision to show very small amounts
 * (e.g. 0.000123) without collapsing to "0".
 */
export function formatAmount(value: number, opts: FormatAmountOptions = {}): string {
  const { minFractionDigits = 0, maxFractionDigits = 6 } = opts

  if (!Number.isFinite(value)) return String(value)
  if (value === 0) return '0'

  // For very small non-zero magnitudes, make sure maxFractionDigits is large
  // enough to show at least a couple of significant digits instead of
  // rounding down to "0".
  const magnitude = Math.abs(value)
  let effectiveMaxFractionDigits = maxFractionDigits
  if (magnitude > 0 && magnitude < 1) {
    const leadingZeros = Math.max(0, -Math.floor(Math.log10(magnitude)) - 1)
    effectiveMaxFractionDigits = Math.max(maxFractionDigits, leadingZeros + 2)
  }

  return value.toLocaleString(undefined, {
    minimumFractionDigits: minFractionDigits,
    maximumFractionDigits: effectiveMaxFractionDigits,
  })
}
