import { describe, expect, it } from 'vitest'
import { readActivityCache, writeActivityCache } from './activityHistoryCache'

// jsdom (this project's Vitest environment) doesn't implement IndexedDB, so
// these tests exercise exactly the contract that matters when it's
// unavailable — the same path a real browser takes in privacy mode, or any
// environment where IndexedDB is disabled: never throw, degrade to "cold
// cache" on read and a silent no-op on write. A real IndexedDB round-trip
// would need a polyfill dependency this project doesn't otherwise need.

describe('activityHistoryCache (IndexedDB unavailable)', () => {
  it('resolves to null on read rather than throwing', async () => {
    await expect(readActivityCache('wallet1')).resolves.toBeNull()
  })

  it('resolves without throwing on write', async () => {
    await expect(
      writeActivityCache('wallet1', { newestSignature: 'sig1', deltas: [] }),
    ).resolves.toBeUndefined()
  })

  it('a write is never observable on the next read (no cache backend to persist to)', async () => {
    await writeActivityCache('wallet1', {
      newestSignature: 'sig1',
      deltas: [{ signature: 'sig1', blockTime: 1_700_000_000, deltas: [{ mint: 'So1', delta: 1 }] }],
    })
    await expect(readActivityCache('wallet1')).resolves.toBeNull()
  })
})
