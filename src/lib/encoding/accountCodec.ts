// accountCodec.ts
//
// Compact, URL-safe encoding for the entire "account" state of the
// portfolio-tracker (no backend, no DB). The whole app state lives in
// one token that can sit in a URL hash and be mirrored to localStorage
// as a cache. See ARCHITECTURE.md §4 for the full spec.
//
// Pipeline:
//   1. Serialize wallets/prefs into a small binary layout (not JSON):
//      addresses are decoded to their native raw bytes (32 bytes for a
//      Solana pubkey instead of ~44 base58 chars; 20 bytes for an EVM
//      address instead of 42 hex chars) — this is the single biggest
//      size win, since addresses are high-entropy and gzip/deflate
//      cannot shrink base58/hex text representations of random bytes.
//   2. Deflate (raw, headerless) the binary blob with `fflate` to squeeze
//      out redundancy from repeated chain bytes / currency code / label
//      patterns across many wallets.
//   3. base64url-encode the compressed bytes with `js-base64` so the
//      result is directly usable in a URL query or hash fragment with no
//      further escaping (alphabet strictly [A-Za-z0-9_-]).
//
// Ported 1:1 from the verified scratch implementation at
// /home/plungarini/native-portfolio/scratch-encode/accountCodec.mjs.

import { deflateSync, inflateSync } from 'fflate'
import { Base64 } from 'js-base64'
import bs58 from 'bs58'
import type { AppState, WalletEntry } from '../../types/state'
import type { ChainId } from '../../types/chain'

export const FORMAT_VERSION = 1

// Chain codes packed into a single byte alongside a "has label" flag.
const CHAIN_CODES: Record<ChainId, number> = { solana: 0, bsc: 1 }
const CHAIN_NAMES: ChainId[] = ['solana', 'bsc']

// Small fixed dictionary of common currencies -> 1 byte each. Anything
// outside the dictionary falls back to code 255 + inline UTF-8 string,
// so the format never breaks even if a new/unknown ticker is used.
const CURRENCY_DICT = [
  'SOL',
  'BNB',
  'USD',
  'EUR',
  'BTC',
  'ETH',
  'GBP',
  'USDC',
  'USDT',
]
const CURRENCY_UNKNOWN = 255

const textEncoder = new TextEncoder()
const textDecoder = new TextDecoder()

/** Minimal growable byte buffer writer. */
class ByteWriter {
  private bytes: number[] = []

  u8(n: number): void {
    this.bytes.push(n & 0xff)
  }

  bytesRaw(arr: Uint8Array): void {
    for (const b of arr) this.bytes.push(b)
  }

  /** length-prefixed (1 byte length, 0-255) UTF-8 string */
  str8(s: string | undefined): void {
    const enc = textEncoder.encode(s ?? '')
    if (enc.length > 255) {
      throw new Error('string too long to encode (max 255 bytes)')
    }
    this.u8(enc.length)
    this.bytesRaw(enc)
  }

  toUint8Array(): Uint8Array {
    return Uint8Array.from(this.bytes)
  }
}

class ByteReader {
  private pos = 0
  private readonly bytes: Uint8Array

  constructor(bytes: Uint8Array) {
    this.bytes = bytes
  }

  u8(): number {
    const value = this.bytes[this.pos]
    if (value === undefined) {
      throw new Error('corrupt token: unexpected end of buffer')
    }
    this.pos += 1
    return value
  }

  bytesRaw(n: number): Uint8Array {
    if (this.pos + n > this.bytes.length) {
      throw new Error('corrupt token: unexpected end of buffer')
    }
    const slice = this.bytes.slice(this.pos, this.pos + n)
    this.pos += n
    return slice
  }

  str8(): string {
    const len = this.u8()
    const slice = this.bytesRaw(len)
    return textDecoder.decode(slice)
  }
}

function encodeAddress(chain: ChainId, address: string): Uint8Array {
  if (chain === 'solana') {
    const raw = bs58.decode(address)
    if (raw.length !== 32) {
      throw new Error(`invalid solana address length: ${address}`)
    }
    return raw
  }
  if (chain === 'bsc') {
    const hex =
      address.startsWith('0x') || address.startsWith('0X')
        ? address.slice(2)
        : address
    if (hex.length !== 40 || !/^[0-9a-fA-F]+$/.test(hex)) {
      throw new Error(`invalid bsc address: ${address}`)
    }
    const raw = new Uint8Array(20)
    for (let i = 0; i < 20; i++) raw[i] = parseInt(hex.substr(i * 2, 2), 16)
    return raw
  }
  throw new Error(`unsupported chain: ${chain as string}`)
}

function decodeAddress(chain: ChainId, raw: Uint8Array): string {
  if (chain === 'solana') return bs58.encode(raw)
  if (chain === 'bsc') {
    let hex = '0x'
    for (const b of raw) hex += b.toString(16).padStart(2, '0')
    return hex
  }
  throw new Error(`unsupported chain: ${chain as string}`)
}

/**
 * Encode account state into a compact, URL-safe token.
 * Pipeline: pack (binary) -> deflate (raw) -> base64url.
 */
export function encode(state: AppState): string {
  const w = new ByteWriter()
  w.u8(state.version)

  // --- main currency ---
  const currencyIdx = CURRENCY_DICT.indexOf(state.mainCurrency)
  if (currencyIdx === -1) {
    w.u8(CURRENCY_UNKNOWN)
    w.str8(state.mainCurrency)
  } else {
    w.u8(currencyIdx)
  }

  // --- wallets ---
  const wallets = state.wallets ?? []
  if (wallets.length > 65535) throw new Error('too many wallets to encode')
  w.u8(wallets.length & 0xff)
  w.u8((wallets.length >> 8) & 0xff) // 16-bit count, little-endian

  for (const wallet of wallets) {
    const chainCode = CHAIN_CODES[wallet.chain]
    if (chainCode === undefined) {
      throw new Error(`unsupported chain: ${wallet.chain as string}`)
    }
    const hasLabel = wallet.label ? 1 : 0
    w.u8((chainCode << 1) | hasLabel) // 1 byte: chain + label-present flag
    w.bytesRaw(encodeAddress(wallet.chain, wallet.address))
    if (hasLabel) w.str8(wallet.label)
  }

  const raw = w.toUint8Array()
  const compressed = deflateSync(raw, { level: 9 })
  return Base64.fromUint8Array(compressed, /* urlsafe */ true)
}

/**
 * Decode a token produced by `encode` back into account state.
 * Throws on any malformed/corrupted/truncated input — callers are
 * expected to catch and fall back per ARCHITECTURE.md §4 point 4.
 */
export function decode(token: string): AppState {
  const compressed = Base64.toUint8Array(token)
  const raw = inflateSync(compressed)
  const r = new ByteReader(raw)

  const version = r.u8()
  if (version !== FORMAT_VERSION) {
    throw new Error(`unsupported account token version: ${version}`)
  }

  const currencyByte = r.u8()
  const mainCurrency =
    currencyByte === CURRENCY_UNKNOWN ? r.str8() : CURRENCY_DICT[currencyByte]
  if (mainCurrency === undefined) {
    throw new Error(`corrupt token: unknown currency code ${currencyByte}`)
  }

  const countLo = r.u8()
  const countHi = r.u8()
  const count = countLo | (countHi << 8)

  const wallets: WalletEntry[] = []
  for (let i = 0; i < count; i++) {
    const head = r.u8()
    const chainCode = head >> 1
    const hasLabel = head & 1
    const chain = CHAIN_NAMES[chainCode]
    if (!chain) {
      throw new Error(`corrupt token: unknown chain code ${chainCode}`)
    }
    const addrLen = chain === 'solana' ? 32 : 20
    const addrRaw = r.bytesRaw(addrLen)
    const address = decodeAddress(chain, addrRaw)
    const wallet: WalletEntry = { chain, address }
    if (hasLabel) wallet.label = r.str8()
    wallets.push(wallet)
  }

  return { version, mainCurrency, wallets }
}
