import { describe, expect, it } from 'vitest'
import { decode, encode, FORMAT_VERSION } from './accountCodec'
import type { AppState, WalletEntry } from '../../types/state'

// 10 realistic-looking Solana addresses (base58, 32-byte pubkeys) and
// 10 realistic-looking BSC/EVM addresses (0x + 40 hex chars).
const SOLANA_ADDRS = [
  'DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK',
  '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM',
  'So11111111111111111111111111111111111111112',
  '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
  '5Q544fKrFoe6tsEbD7S8EmxGTJYAKtTVhAW5Q5pge4j1',
  'EhYXq3ANp5nAerUpbSgd7VK2RRcxK1zNuSQ755G5Mtxx',
  'CTj4CAyPUCV3nFuTLEBP2vpMTHMaHzHBqZzvGZzZzNKr',
  '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R',
  'AobVSwdW9BbpMdJvTqeCN4hPAmh4rHm7vwLnQ5ATSyrS',
  'GThUX1Atko4tqhN2NaiTazWSeFWMuiUvfFnyJyUghFMJ',
]

// Deterministically generated valid-looking 20-byte EVM addresses
// (0x + 40 hex chars). No cryptographic property is needed here — this
// just needs to be deterministic and pass the hex-address validator.
function deterministicHex40(seed: string): string {
  let h1 = 0x811c9dc5
  let h2 = 0x9e3779b9
  for (let i = 0; i < seed.length; i++) {
    const c = seed.charCodeAt(i)
    h1 = Math.imul(h1 ^ c, 0x01000193)
    h2 = Math.imul(h2 ^ c, 0x85ebca6b)
  }
  let out = ''
  let a = h1 >>> 0
  let b = h2 >>> 0
  while (out.length < 40) {
    a = Math.imul(a ^ (a >>> 15), 0x2c1b3c6d) >>> 0
    b = Math.imul(b ^ (b >>> 13), 0x297a2d39) >>> 0
    out += ((a ^ b) >>> 0).toString(16).padStart(8, '0')
  }
  return out.slice(0, 40)
}

const BSC_ADDRS = Array.from(
  { length: 10 },
  (_, i) => '0x' + deterministicHex40(`bsc-wallet-${i}`),
)

function makeWallets(n: number): WalletEntry[] {
  return Array.from({ length: n }, (_, i) => ({
    chain: i % 2 === 0 ? ('solana' as const) : ('bsc' as const),
    address:
      i % 2 === 0
        ? SOLANA_ADDRS[i % SOLANA_ADDRS.length]
        : BSC_ADDRS[i % BSC_ADDRS.length],
    label: `Wallet #${i} some label`,
  }))
}

function makeState(walletCount: number): AppState {
  return {
    version: FORMAT_VERSION,
    mainCurrency: 'SOL',
    wallets: makeWallets(walletCount),
  }
}

describe('accountCodec round-trip', () => {
  it.each([0, 1, 20, 100])('losslessly round-trips %d wallets', (count) => {
    const state = makeState(count)
    const token = encode(state)
    const decoded = decode(token)
    expect(decoded).toStrictEqual(state)
  })

  it('round-trips a wallet with no label', () => {
    const state: AppState = {
      version: FORMAT_VERSION,
      mainCurrency: 'SOL',
      wallets: [{ chain: 'solana', address: SOLANA_ADDRS[0] }],
    }
    expect(decode(encode(state))).toStrictEqual(state)
  })

  it('round-trips an unknown/custom main currency via the fallback path', () => {
    const state: AppState = {
      version: FORMAT_VERSION,
      mainCurrency: 'JPY',
      wallets: [],
    }
    expect(decode(encode(state))).toStrictEqual(state)
  })

  it('produces a token using strictly the [A-Za-z0-9_-] alphabet', () => {
    const state = makeState(20)
    const token = encode(state)
    expect(token.length).toBeGreaterThan(0)
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/)
  })
})

describe('accountCodec decode failure handling', () => {
  it('throws (rather than silently returning garbage) on a corrupted token', () => {
    expect(() => decode('this-is-not-a-valid-token-!!!')).toThrow()
  })

  it('throws on a truncated token', () => {
    const token = encode(makeState(5))
    const truncated = token.slice(0, Math.floor(token.length / 3))
    expect(() => decode(truncated)).toThrow()
  })
})
