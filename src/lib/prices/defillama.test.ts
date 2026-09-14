import { afterEach, describe, expect, it, vi } from 'vitest'
import { getCurrentPrice, getDailyAveragePrice, getHistoricalPrice } from './defillama'

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response
}

describe('defillama', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  describe('getCurrentPrice', () => {
    it('requests /prices/current/{coinId} and returns the price', async () => {
      const fetchMock = vi.fn().mockResolvedValueOnce(
        jsonResponse({
          coins: {
            'coingecko:solana': { price: 150.25, symbol: 'SOL', timestamp: 1700000000 },
          },
        }),
      )
      vi.stubGlobal('fetch', fetchMock)

      const price = await getCurrentPrice('coingecko:solana')

      expect(fetchMock).toHaveBeenCalledTimes(1)
      expect(fetchMock).toHaveBeenCalledWith(
        'https://coins.llama.fi/prices/current/coingecko:solana',
      )
      expect(price).toBe(150.25)
    })

    it('returns null when the coin is absent from the response', async () => {
      const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse({ coins: {} }))
      vi.stubGlobal('fetch', fetchMock)

      const price = await getCurrentPrice('solana:SomeUnknownMint')

      expect(price).toBeNull()
    })

    it('throws on a non-ok HTTP response', async () => {
      const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse({}, 500))
      vi.stubGlobal('fetch', fetchMock)

      await expect(getCurrentPrice('coingecko:solana')).rejects.toThrow()
    })
  })

  describe('getHistoricalPrice', () => {
    it('requests /prices/historical/{ts}/{coinId} and returns the price', async () => {
      const fetchMock = vi.fn().mockResolvedValueOnce(
        jsonResponse({
          coins: {
            'bsc:0xe9e7cea3dedca5984780bafc599bd69add087d56': {
              price: 0.999,
              symbol: 'BUSD',
              timestamp: 1699999999,
            },
          },
        }),
      )
      vi.stubGlobal('fetch', fetchMock)

      const price = await getHistoricalPrice(
        'bsc:0xe9e7cea3dedca5984780bafc599bd69add087d56',
        1700000000,
      )

      expect(fetchMock).toHaveBeenCalledWith(
        'https://coins.llama.fi/prices/historical/1700000000/bsc:0xe9e7cea3dedca5984780bafc599bd69add087d56',
      )
      expect(price).toBe(0.999)
    })

    it('returns null when the coin is absent from the response', async () => {
      const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse({ coins: {} }))
      vi.stubGlobal('fetch', fetchMock)

      const price = await getHistoricalPrice('coingecko:binancecoin', 1700000000)

      expect(price).toBeNull()
    })
  })

  describe('getDailyAveragePrice', () => {
    it('requests /chart/{coinId} with start/span/period params and averages the 24 hourly points', async () => {
      // Fixed 24-point fixture: prices 100, 101, 102, ..., 123 → average 111.5.
      const prices = Array.from({ length: 24 }, (_, i) => ({
        timestamp: 1700000000 + i * 3600,
        price: 100 + i,
      }))
      const fetchMock = vi.fn().mockResolvedValueOnce(
        jsonResponse({
          coins: {
            'coingecko:solana': { symbol: 'SOL', prices },
          },
        }),
      )
      vi.stubGlobal('fetch', fetchMock)

      const average = await getDailyAveragePrice('coingecko:solana', 1700000000)

      expect(fetchMock).toHaveBeenCalledWith(
        'https://coins.llama.fi/chart/coingecko:solana?start=1700000000&span=24&period=1h',
      )
      expect(average).toBeCloseTo(111.5)
    })

    it('returns null when there are no hourly points', async () => {
      const fetchMock = vi.fn().mockResolvedValueOnce(
        jsonResponse({ coins: { 'coingecko:solana': { symbol: 'SOL', prices: [] } } }),
      )
      vi.stubGlobal('fetch', fetchMock)

      const average = await getDailyAveragePrice('coingecko:solana', 1700000000)

      expect(average).toBeNull()
    })

    it('returns null when the coin is absent from the response entirely', async () => {
      const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse({ coins: {} }))
      vi.stubGlobal('fetch', fetchMock)

      const average = await getDailyAveragePrice('coingecko:solana', 1700000000)

      expect(average).toBeNull()
    })
  })
})
