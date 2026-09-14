import { describe, expect, it } from 'vitest'
import { formatAmount } from './number'

describe('formatAmount', () => {
  it('formats zero as "0"', () => {
    expect(formatAmount(0)).toBe('0')
  })

  it('trims trailing zeros for whole numbers', () => {
    expect(formatAmount(12)).toBe('12')
  })

  it('formats a typical fractional amount', () => {
    expect(formatAmount(12.4)).toBe('12.4')
  })

  it('formats negative amounts', () => {
    expect(formatAmount(-1.2)).toBe('-1.2')
  })

  it('shows very small amounts without collapsing to 0', () => {
    expect(formatAmount(0.00001234)).not.toBe('0')
    expect(formatAmount(0.00001234)).toContain('0.000012')
  })

  it('adds thousands separators for large amounts', () => {
    expect(formatAmount(1234567)).toBe('1,234,567')
  })

  it('respects a custom maxFractionDigits', () => {
    expect(formatAmount(1.123456789, { maxFractionDigits: 2 })).toBe('1.12')
  })

  it('respects a minFractionDigits floor', () => {
    expect(formatAmount(5, { minFractionDigits: 2 })).toBe('5.00')
  })
})
