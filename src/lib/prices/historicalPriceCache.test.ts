import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as defillama from './defillama'
import { getCachedDailyAveragePrice, getCachedHistoricalPrice } from './historicalPriceCache'

describe('historicalPriceCache', () => {
  beforeEach(() => {
    window.localStorage.clear()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('getCachedHistoricalPrice', () => {
    it('fetches and caches on a cache miss', async () => {
      const spy = vi.spyOn(defillama, 'getHistoricalPrice').mockResolvedValueOnce(150.25)

      const price = await getCachedHistoricalPrice('coingecko:solana', 1700000000)

      expect(price).toBe(150.25)
      expect(spy).toHaveBeenCalledTimes(1)
      expect(spy).toHaveBeenCalledWith('coingecko:solana', 1700000000)

      // Stored under the hour-rounded key.
      const stored = window.localStorage.getItem(
        'priceCache:v1:historical:coingecko:solana:1699999200',
      )
      expect(stored).toBe('150.25')
    })

    it('never re-fetches on a cache hit, even for a different timestamp in the same hour', async () => {
      const spy = vi.spyOn(defillama, 'getHistoricalPrice').mockResolvedValueOnce(150.25)

      await getCachedHistoricalPrice('coingecko:solana', 1700000000)
      const second = await getCachedHistoricalPrice('coingecko:solana', 1700000123)

      expect(second).toBe(150.25)
      expect(spy).toHaveBeenCalledTimes(1)
    })

    it('does not cache a null (unavailable) result', async () => {
      const spy = vi.spyOn(defillama, 'getHistoricalPrice').mockResolvedValue(null)

      const first = await getCachedHistoricalPrice('solana:UnknownMint', 1700000000)
      const second = await getCachedHistoricalPrice('solana:UnknownMint', 1700000000)

      expect(first).toBeNull()
      expect(second).toBeNull()
      expect(spy).toHaveBeenCalledTimes(2)
    })
  })

  describe('getCachedDailyAveragePrice', () => {
    it('fetches and caches on a cache miss', async () => {
      const spy = vi.spyOn(defillama, 'getDailyAveragePrice').mockResolvedValueOnce(111.5)

      const average = await getCachedDailyAveragePrice('coingecko:solana', 1700000000)

      expect(average).toBe(111.5)
      expect(spy).toHaveBeenCalledTimes(1)
      expect(spy).toHaveBeenCalledWith('coingecko:solana', 1700000000)
    })

    it('never re-fetches on a cache hit', async () => {
      const spy = vi.spyOn(defillama, 'getDailyAveragePrice').mockResolvedValueOnce(111.5)

      await getCachedDailyAveragePrice('coingecko:solana', 1700000000)
      const second = await getCachedDailyAveragePrice('coingecko:solana', 1700000000)

      expect(second).toBe(111.5)
      expect(spy).toHaveBeenCalledTimes(1)
    })

    it('uses separate cache entries per coinId', async () => {
      const spy = vi
        .spyOn(defillama, 'getDailyAveragePrice')
        .mockResolvedValueOnce(111.5)
        .mockResolvedValueOnce(722.1)

      const sol = await getCachedDailyAveragePrice('coingecko:solana', 1700000000)
      const bnb = await getCachedDailyAveragePrice('coingecko:binancecoin', 1700000000)

      expect(sol).toBe(111.5)
      expect(bnb).toBe(722.1)
      expect(spy).toHaveBeenCalledTimes(2)
    })
  })
})
