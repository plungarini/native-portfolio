import { beforeEach, describe, expect, it } from 'vitest'
import { encode, FORMAT_VERSION } from './accountCodec'
import {
  loadInitialState,
  persistState,
  STORAGE_KEY,
} from './storagePersistence'
import { readTokenFromHash } from './urlState'
import type { AppState } from '../../types/state'

const STATE_A: AppState = {
  version: FORMAT_VERSION,
  mainCurrency: 'SOL',
  wallets: [
    {
      chain: 'solana',
      address: 'DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK',
      label: 'From hash',
    },
  ],
}

const STATE_B: AppState = {
  version: FORMAT_VERSION,
  mainCurrency: 'USD',
  wallets: [
    {
      chain: 'bsc',
      address: '0x1111111111111111111111111111111111111111',
      label: 'From storage',
    },
  ],
}

function setHash(token: string | null): void {
  window.location.hash = token === null ? '' : `a=${token}`
}

beforeEach(() => {
  window.localStorage.clear()
  window.location.hash = ''
})

describe('storagePersistence: hash-vs-localStorage precedence', () => {
  it('hash wins when both a hash token and a localStorage token are present', () => {
    const tokenA = encode(STATE_A)
    const tokenB = encode(STATE_B)

    window.localStorage.setItem(STORAGE_KEY, tokenB)
    setHash(tokenA)

    const state = loadInitialState()

    expect(state).toStrictEqual(STATE_A)
    // localStorage is re-mirrored to match the winning hash token.
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe(tokenA)
  })

  it('falls back to localStorage and rewrites the hash when no hash is present', () => {
    const tokenB = encode(STATE_B)
    window.localStorage.setItem(STORAGE_KEY, tokenB)
    setHash(null)

    const state = loadInitialState()

    expect(state).toStrictEqual(STATE_B)
    expect(readTokenFromHash()).toBe(tokenB)
  })
})

describe('storagePersistence: decode-failure fallback path', () => {
  it('falls back to localStorage when the hash token is corrupted, never throwing', () => {
    const tokenB = encode(STATE_B)
    window.localStorage.setItem(STORAGE_KEY, tokenB)
    setHash('not-a-valid-token-!!!')

    let state: AppState | undefined
    expect(() => {
      state = loadInitialState()
    }).not.toThrow()

    expect(state).toStrictEqual(STATE_B)
  })

  it('falls back to an empty AppState when both hash and localStorage are corrupted/absent, never throwing', () => {
    setHash('not-a-valid-token-!!!')
    window.localStorage.setItem(STORAGE_KEY, 'also-not-valid-!!!')

    let state: AppState | undefined
    expect(() => {
      state = loadInitialState()
    }).not.toThrow()

    expect(state).toStrictEqual({
      version: FORMAT_VERSION,
      mainCurrency: 'SOL',
      wallets: [],
    })
  })

  it('falls back to an empty AppState when hash is corrupted and localStorage is absent, never throwing', () => {
    setHash('not-a-valid-token-!!!')

    let state: AppState | undefined
    expect(() => {
      state = loadInitialState()
    }).not.toThrow()

    expect(state).toStrictEqual({
      version: FORMAT_VERSION,
      mainCurrency: 'SOL',
      wallets: [],
    })
  })

  it('falls back to an empty AppState when both hash and localStorage are absent, never throwing', () => {
    let state: AppState | undefined
    expect(() => {
      state = loadInitialState()
    }).not.toThrow()

    expect(state).toStrictEqual({
      version: FORMAT_VERSION,
      mainCurrency: 'SOL',
      wallets: [],
    })
  })
})

describe('storagePersistence: mutation persistence', () => {
  it('persistState synchronously updates both the hash and localStorage', () => {
    persistState(STATE_A)

    const expectedToken = encode(STATE_A)
    expect(readTokenFromHash()).toBe(expectedToken)
    expect(window.localStorage.getItem(STORAGE_KEY)).toBe(expectedToken)
  })
})
