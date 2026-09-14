import { describe, expect, it } from 'vitest'
import {
  PRICE_UNAVAILABLE,
  formatHoldingValue,
  formatMainCurrency,
  formatSignedMainCurrency,
  formatSignedUsd,
  formatUsd,
} from './currency'

describe('formatUsd', () => {
  it('renders null as "price unavailable"', () => {
    expect(formatUsd(null)).toBe(PRICE_UNAVAILABLE)
  })

  it('formats zero', () => {
    expect(formatUsd(0)).toBe('$0.00')
  })

  it('formats a typical value with thousands separator', () => {
    expect(formatUsd(1860)).toBe('$1,860.00')
  })

  it('formats negative values without a forced sign beyond the minus', () => {
    expect(formatUsd(-148)).toBe('-$148.00')
  })

  it('formats large values', () => {
    expect(formatUsd(1234567.89)).toBe('$1,234,567.89')
  })

  it('does not add a leading "+" for positive values', () => {
    expect(formatUsd(148)).toBe('$148.00')
  })
})

describe('formatSignedUsd', () => {
  it('renders null as "price unavailable"', () => {
    expect(formatSignedUsd(null)).toBe(PRICE_UNAVAILABLE)
  })

  it('prefixes "+" for a gain', () => {
    expect(formatSignedUsd(148)).toBe('+$148.00')
  })

  it('keeps the minus sign for a loss, no double sign', () => {
    expect(formatSignedUsd(-148)).toBe('-$148.00')
  })

  it('does not prefix "+" for zero', () => {
    expect(formatSignedUsd(0)).toBe('$0.00')
  })
})

describe('formatMainCurrency', () => {
  it('renders null as "price unavailable"', () => {
    expect(formatMainCurrency(null, 'SOL')).toBe(PRICE_UNAVAILABLE)
  })

  it('formats a typical holding amount with the symbol', () => {
    expect(formatMainCurrency(12.4, 'SOL')).toBe('12.4 SOL')
  })

  it('formats zero', () => {
    expect(formatMainCurrency(0, 'SOL')).toBe('0 SOL')
  })

  it('formats a very small amount without collapsing to 0', () => {
    expect(formatMainCurrency(0.00001234, 'SOL')).not.toBe('0 SOL')
  })

  it('formats a large amount with separators', () => {
    expect(formatMainCurrency(1234567, 'SOL')).toBe('1,234,567 SOL')
  })
})

describe('formatSignedMainCurrency', () => {
  it('renders null as "price unavailable"', () => {
    expect(formatSignedMainCurrency(null, 'SOL')).toBe(PRICE_UNAVAILABLE)
  })

  it('prefixes "+" for a PnL gain, e.g. "+1.2 SOL"', () => {
    expect(formatSignedMainCurrency(1.2, 'SOL')).toBe('+1.2 SOL')
  })

  it('keeps a single minus sign for a loss', () => {
    expect(formatSignedMainCurrency(-1.2, 'SOL')).toBe('-1.2 SOL')
  })
})

describe('formatHoldingValue', () => {
  it('matches the §5.1 example: "12.4 SOL (~$1,860)"', () => {
    expect(formatHoldingValue(12.4, 1860, 'SOL')).toBe('12.4 SOL (~$1,860)')
  })

  it('renders "price unavailable" for the main-currency half when null', () => {
    expect(formatHoldingValue(null, 1860, 'SOL')).toBe(`${PRICE_UNAVAILABLE} (~$1,860)`)
  })

  it('renders "price unavailable" inside the parens when usdValue is null', () => {
    expect(formatHoldingValue(12.4, null, 'SOL')).toBe(`12.4 SOL (${PRICE_UNAVAILABLE})`)
  })
})
