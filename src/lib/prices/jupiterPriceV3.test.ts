import { afterEach, describe, expect, it, vi } from 'vitest'
import { getCurrentPricesJupiter } from './jupiterPriceV3'

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response
}

const SOL_MINT = 'So11111111111111111111111111111111111111112'
const JUP_MINT = 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN'

describe('getCurrentPricesJupiter', () => {
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('requests /price/v3 with a comma-joined ids param and returns a mint->usdPrice map', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse({
        [SOL_MINT]: { usdPrice: 150.25, blockId: 1, decimals: 9, priceChange24h: 1.2 },
        [JUP_MINT]: { usdPrice: 0.5, blockId: 1, decimals: 6, priceChange24h: -2.1 },
      }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const prices = await getCurrentPricesJupiter([SOL_MINT, JUP_MINT])

    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock).toHaveBeenCalledWith(
      `https://lite-api.jup.ag/price/v3?ids=${SOL_MINT},${JUP_MINT}`,
    )
    expect(prices).toEqual({ [SOL_MINT]: 150.25, [JUP_MINT]: 0.5 })
  })

  it('omits mints with no entry in the response', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(
      jsonResponse({ [SOL_MINT]: { usdPrice: 150.25 } }),
    )
    vi.stubGlobal('fetch', fetchMock)

    const prices = await getCurrentPricesJupiter([SOL_MINT, JUP_MINT])

    expect(prices).toEqual({ [SOL_MINT]: 150.25 })
  })

  it('returns {} for an empty input without calling fetch', async () => {
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    const prices = await getCurrentPricesJupiter([])

    expect(prices).toEqual({})
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('throws on a non-ok HTTP response', async () => {
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse({}, 500))
    vi.stubGlobal('fetch', fetchMock)

    await expect(getCurrentPricesJupiter([SOL_MINT])).rejects.toThrow()
  })
})
