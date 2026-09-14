import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getSnapshotPrice, resetSnapshotCache } from './snapshotFallback'

const SNAPSHOT_FIXTURE = {
  generatedAt: '2026-09-14T11:40:21.385Z',
  prices: {
    SOL: { usd: 101.57, symbol: 'SOL', coingeckoId: 'solana', timestamp: 1789385920 },
    BNB: { usd: 722.19, symbol: 'BNB', coingeckoId: 'binancecoin', timestamp: 1789385920 },
  },
}

function jsonResponse(body: unknown, status = 200) {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response
}

describe('snapshotFallback', () => {
  beforeEach(() => {
    resetSnapshotCache()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it('fetches /snapshots/prices-latest.json under the Vite base path and returns a known symbol', async () => {
    vi.stubEnv('BASE_URL', '/native-portfolio/')
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(SNAPSHOT_FIXTURE))
    vi.stubGlobal('fetch', fetchMock)

    const price = await getSnapshotPrice('SOL')

    expect(fetchMock).toHaveBeenCalledWith(
      '/native-portfolio/snapshots/prices-latest.json',
    )
    expect(price).toEqual(SNAPSHOT_FIXTURE.prices.SOL)
  })

  it('respects a base path without a trailing slash', async () => {
    vi.stubEnv('BASE_URL', '/native-portfolio')
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(SNAPSHOT_FIXTURE))
    vi.stubGlobal('fetch', fetchMock)

    await getSnapshotPrice('SOL')

    expect(fetchMock).toHaveBeenCalledWith(
      '/native-portfolio/snapshots/prices-latest.json',
    )
  })

  it('returns undefined (never a substituted value) for a symbol not in the snapshot', async () => {
    vi.stubEnv('BASE_URL', '/')
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(SNAPSHOT_FIXTURE))
    vi.stubGlobal('fetch', fetchMock)

    const price = await getSnapshotPrice('SOME_OBSCURE_TOKEN')

    expect(price).toBeUndefined()
  })

  it('returns undefined when the snapshot file itself is unreachable', async () => {
    vi.stubEnv('BASE_URL', '/')
    const fetchMock = vi.fn().mockRejectedValueOnce(new TypeError('Failed to fetch'))
    vi.stubGlobal('fetch', fetchMock)

    const price = await getSnapshotPrice('SOL')

    expect(price).toBeUndefined()
  })

  it('only fetches the snapshot once across multiple lookups', async () => {
    vi.stubEnv('BASE_URL', '/')
    const fetchMock = vi.fn().mockResolvedValueOnce(jsonResponse(SNAPSHOT_FIXTURE))
    vi.stubGlobal('fetch', fetchMock)

    await getSnapshotPrice('SOL')
    await getSnapshotPrice('BNB')

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})
