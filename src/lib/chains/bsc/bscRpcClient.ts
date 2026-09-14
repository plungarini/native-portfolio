// BSC eth_call/eth_getLogs + Multicall3 batching client — implemented in Phase 3, per ARCHITECTURE.md §3.2/§7.
//
// No API key anywhere in this module: everything is a plain JSON-RPC POST
// against `bscRpcHosts` (config/chains.ts), round-robining to the next host
// on a network error or HTTP 429/5xx response.

import {
  bscMulticall3Address,
  bscRpcHosts,
  type KnownToken,
} from '../../../config/chains'

// ---------------------------------------------------------------------------
// Low-level hex/ABI helpers
// ---------------------------------------------------------------------------

/** Strips an optional `0x` prefix. */
function stripHexPrefix(hex: string): string {
  return hex.startsWith('0x') || hex.startsWith('0X') ? hex.slice(2) : hex
}

/** Parses a `0x...`-prefixed (or bare) hex string into a bigint. Empty/`0x` → 0n. */
export function hexToBigInt(hex: string): bigint {
  const stripped = stripHexPrefix(hex)
  if (stripped === '') return 0n
  return BigInt('0x' + stripped)
}

/** Left-pads a hex string (no `0x` prefix) to a 32-byte (64 hex char) word. */
function padWord(hex: string): string {
  return hex.padStart(64, '0')
}

function encodeUint256(n: bigint): string {
  if (n < 0n) throw new Error('encodeUint256: negative values not supported')
  return padWord(n.toString(16))
}

function encodeAddress(address: string): string {
  return padWord(stripHexPrefix(address).toLowerCase())
}

function encodeBool(b: boolean): string {
  return padWord(b ? '1' : '0')
}

/** ABI-encodes a dynamic `bytes` value (length word + right-padded data). */
function encodeBytesDynamic(dataHexNoPrefix: string): string {
  const lengthBytes = dataHexNoPrefix.length / 2
  const padLength = (64 - (dataHexNoPrefix.length % 64)) % 64
  return (
    encodeUint256(BigInt(lengthBytes)) + dataHexNoPrefix + '0'.repeat(padLength)
  )
}

/** Pads a 20-byte address into a 32-byte `eth_getLogs` topic value. */
export function addressToTopic(address: string): string {
  return '0x' + encodeAddress(address)
}

/** Converts a block number into the JSON-RPC hex quantity form. */
export function blockNumberToHex(blockNumber: number): string {
  return '0x' + Math.trunc(blockNumber).toString(16)
}

/**
 * Scales a raw on-chain integer amount (e.g. wei, or a token's smallest
 * unit) down by `decimals`, via string arithmetic so the division itself
 * never loses precision (only the final `Number()` conversion does, which
 * is fine for display purposes).
 */
export function scaleRawAmount(raw: bigint, decimals: number): number {
  const negative = raw < 0n
  const abs = negative ? -raw : raw
  const divisor = 10n ** BigInt(decimals)
  const whole = abs / divisor
  const remainder = abs % divisor
  const fraction = remainder.toString().padStart(decimals, '0')
  const combined = decimals > 0 ? `${whole}.${fraction}` : whole.toString()
  const value = Number(combined)
  return negative ? -value : value
}

// ---------------------------------------------------------------------------
// Multicall3 aggregate3 ABI encode/decode
// ---------------------------------------------------------------------------

const MULTICALL3_AGGREGATE3_SELECTOR = '0x82ad56cb'
const BALANCE_OF_SELECTOR = '0x70a08231'
const DECIMALS_SELECTOR = '0x313ce567'
export const ERC20_TRANSFER_TOPIC =
  '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'

export interface Call3 {
  target: string
  allowFailure: boolean
  /** `0x`-prefixed calldata for this call. */
  callData: string
}

export interface Multicall3Result {
  success: boolean
  /** `0x`-prefixed raw return data. */
  returnData: string
}

/** Encodes `balanceOf(address)` calldata for an ERC-20/BEP-20 token contract. */
export function encodeBalanceOfCalldata(ownerAddress: string): string {
  return BALANCE_OF_SELECTOR + encodeAddress(ownerAddress)
}

/**
 * Encodes a full `aggregate3(Call3[])` calldata blob (selector included) per
 * the standard Solidity ABI encoding for a dynamic array of dynamic tuples.
 */
export function encodeAggregate3Calldata(calls: Call3[]): string {
  const tuples = calls.map((call) => {
    const callDataNoPrefix = stripHexPrefix(call.callData)
    // Head: address (32B) + bool (32B) + offset-to-bytes (32B, always 0x60
    // since bytes is the only dynamic field and it's the 3rd/last field).
    const head =
      encodeAddress(call.target) +
      encodeBool(call.allowFailure) +
      encodeUint256(0x60n)
    const tail = encodeBytesDynamic(callDataNoPrefix)
    return head + tail
  })

  // Offsets are relative to the start of the array's element area, i.e.
  // right after the array-length word — which is exactly the size of the
  // offset-word section itself (`calls.length * 32` bytes).
  let running = BigInt(calls.length) * 32n
  const offsetWords: string[] = []
  for (const tuple of tuples) {
    offsetWords.push(encodeUint256(running))
    running += BigInt(tuple.length / 2)
  }

  const arrayData =
    encodeUint256(BigInt(calls.length)) + offsetWords.join('') + tuples.join('')
  // Single top-level dynamic parameter: offset (always 0x20) then the array data.
  return MULTICALL3_AGGREGATE3_SELECTOR + encodeUint256(0x20n) + arrayData
}

/** Decodes the `Result[]` returned by `aggregate3`/`tryAggregate`-style calls. */
export function decodeAggregate3Result(hex: string): Multicall3Result[] {
  const data = stripHexPrefix(hex)
  if (data === '') return []

  const word = (charOffset: number): string =>
    data.slice(charOffset, charOffset + 64)

  const arrayDataOffset = Number(hexToBigInt(word(0))) * 2 // bytes -> hex chars
  const length = Number(hexToBigInt(word(arrayDataOffset)))
  const elementsAreaStart = arrayDataOffset + 64 // right after the length word

  const results: Multicall3Result[] = []
  for (let i = 0; i < length; i++) {
    const offsetWordStart = elementsAreaStart + i * 64
    const elementOffset = Number(hexToBigInt(word(offsetWordStart))) * 2
    const elementStart = elementsAreaStart + elementOffset

    const success = hexToBigInt(word(elementStart)) === 1n
    // `bytesOffset` is relative to the start of this tuple (`elementStart`)
    // and already accounts for the two head words (bool + offset).
    const bytesOffset = Number(hexToBigInt(word(elementStart + 64))) * 2
    const bytesStart = elementStart + bytesOffset
    const bytesLength = Number(hexToBigInt(word(bytesStart)))
    const bytesDataStart = bytesStart + 64
    const returnData = data.slice(
      bytesDataStart,
      bytesDataStart + bytesLength * 2,
    )

    results.push({ success, returnData: '0x' + returnData })
  }
  return results
}

// ---------------------------------------------------------------------------
// JSON-RPC transport, with fallback-host round-robin
// ---------------------------------------------------------------------------

interface JsonRpcSuccess<T> {
  jsonrpc: '2.0'
  id: number
  result: T
}

interface JsonRpcError {
  jsonrpc: '2.0'
  id: number
  error: { code: number; message: string }
}

let currentHostIndex = 0
let requestId = 0

/**
 * POSTs a JSON-RPC request to the current host in `bscRpcHosts`. On a
 * network error or an HTTP 429/5xx response, advances to the next host in
 * the list and retries, until every host has been tried once.
 */
export async function rpcRequest<T>(
  method: string,
  params: unknown[],
): Promise<T> {
  let lastError: unknown

  for (let attempt = 0; attempt < bscRpcHosts.length; attempt++) {
    const hostIndex = (currentHostIndex + attempt) % bscRpcHosts.length
    const host = bscRpcHosts[hostIndex]

    try {
      const response = await fetch(host, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: ++requestId,
          method,
          params,
        }),
      })

      if (response.status === 429 || response.status >= 500) {
        lastError = new Error(
          `BSC RPC host ${host} returned HTTP ${response.status}`,
        )
        continue
      }

      const json = (await response.json()) as JsonRpcSuccess<T> | JsonRpcError
      if ('error' in json) {
        lastError = new Error(
          `BSC RPC error from ${host}: ${json.error.message}`,
        )
        continue
      }

      // This host is healthy — stick with it for the next call.
      currentHostIndex = hostIndex
      return json.result
    } catch (err) {
      lastError = err
    }
  }

  throw new Error(
    `All BSC RPC hosts failed for ${method}: ${lastError instanceof Error ? lastError.message : String(lastError)}`,
  )
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** Fetches the native BNB balance for `address`, in BNB (already wei→BNB scaled). */
export async function getBnbBalance(address: string): Promise<number> {
  const weiHex = await rpcRequest<string>('eth_getBalance', [address, 'latest'])
  return scaleRawAmount(hexToBigInt(weiHex), 18)
}

const tokenDecimalsCache = new Map<string, number>()

/** Fetches (and permanently caches) a token contract's `decimals()`. */
export async function getTokenDecimals(tokenAddress: string): Promise<number> {
  const key = tokenAddress.toLowerCase()
  const cached = tokenDecimalsCache.get(key)
  if (cached !== undefined) return cached

  const resultHex = await rpcRequest<string>('eth_call', [
    { to: tokenAddress, data: DECIMALS_SELECTOR },
    'latest',
  ])
  const decimals = Number(hexToBigInt(resultHex))
  tokenDecimalsCache.set(key, decimals)
  return decimals
}

/** Clears the module-level `decimals()` cache. Exposed for test isolation. */
export function clearTokenDecimalsCache(): void {
  tokenDecimalsCache.clear()
}

export interface TokenBalance {
  token: KnownToken
  /** Raw on-chain integer balance (token's smallest unit). */
  amountRaw: bigint
  /** `amountRaw` scaled down by `token.decimals`. */
  amount: number
}

/**
 * Fetches `balanceOf(address)` for every token in `tokenList`, batched into
 * a single `eth_call` against the Multicall3 contract.
 */
export async function getTokenBalances(
  address: string,
  tokenList: KnownToken[],
): Promise<TokenBalance[]> {
  if (tokenList.length === 0) return []

  const calls: Call3[] = tokenList.map((token) => ({
    target: token.address,
    allowFailure: true,
    callData: encodeBalanceOfCalldata(address),
  }))

  const calldata = encodeAggregate3Calldata(calls)
  const resultHex = await rpcRequest<string>('eth_call', [
    { to: bscMulticall3Address, data: calldata },
    'latest',
  ])
  const decoded = decodeAggregate3Result(resultHex)

  return tokenList.map((token, i) => {
    const result = decoded[i]
    const raw =
      result?.success && result.returnData !== '0x'
        ? hexToBigInt(result.returnData)
        : 0n
    return {
      token,
      amountRaw: raw,
      amount: scaleRawAmount(raw, token.decimals),
    }
  })
}

export interface TransferLogEntry {
  txHash: string
  blockNumber: number
  logIndex: number
  tokenAddress: string
  from: string
  to: string
  amountRaw: bigint
  /** `amountRaw` scaled down by the token's `decimals()`. */
  amount: number
}

/** Public nodes cap `eth_getLogs` at roughly a 5,000-block window per call. */
const MAX_BLOCK_RANGE = 5000

interface RawEthLog {
  transactionHash: string
  blockNumber: string
  logIndex: string
  address: string
  topics: string[]
  data: string
}

function parseTransferLog(log: RawEthLog, decimals: number): TransferLogEntry {
  return {
    txHash: log.transactionHash,
    blockNumber: Number(hexToBigInt(log.blockNumber)),
    logIndex: Number(hexToBigInt(log.logIndex)),
    tokenAddress: log.address.toLowerCase(),
    from: '0x' + log.topics[1].slice(-40),
    to: '0x' + log.topics[2].slice(-40),
    amountRaw: hexToBigInt(log.data),
    amount: scaleRawAmount(hexToBigInt(log.data), decimals),
  }
}

async function fetchTransferLogsWindow(
  tokenAddress: string,
  fromTopic: string | null,
  toTopic: string | null,
  fromBlock: number,
  toBlock: number,
): Promise<RawEthLog[]> {
  return rpcRequest<RawEthLog[]>('eth_getLogs', [
    {
      address: tokenAddress,
      fromBlock: blockNumberToHex(fromBlock),
      toBlock: blockNumberToHex(toBlock),
      topics: [ERC20_TRANSFER_TOPIC, fromTopic, toTopic],
    },
  ])
}

/**
 * Fetches every ERC-20/BEP-20 `Transfer` log involving `address` (either as
 * sender or recipient) for `tokenAddress`, between `fromBlock` and
 * `toBlock` inclusive. Paginates backwards from `toBlock` in bounded
 * windows, since public RPC nodes reject overly wide `eth_getLogs` ranges.
 */
export async function getTransferLogs(
  address: string,
  tokenAddress: string,
  fromBlock: number,
  toBlock: number,
): Promise<TransferLogEntry[]> {
  const decimals = await getTokenDecimals(tokenAddress)
  const addressTopic = addressToTopic(address)

  const seen = new Set<string>()
  const entries: TransferLogEntry[] = []

  let windowEnd = toBlock
  while (windowEnd >= fromBlock) {
    const windowStart = Math.max(fromBlock, windowEnd - MAX_BLOCK_RANGE + 1)

    const [outgoing, incoming] = await Promise.all([
      fetchTransferLogsWindow(
        tokenAddress,
        addressTopic,
        null,
        windowStart,
        windowEnd,
      ),
      fetchTransferLogsWindow(
        tokenAddress,
        null,
        addressTopic,
        windowStart,
        windowEnd,
      ),
    ])

    for (const rawLog of [...outgoing, ...incoming]) {
      const entry = parseTransferLog(rawLog, decimals)
      const key = `${entry.txHash}:${entry.logIndex}`
      if (seen.has(key)) continue
      seen.add(key)
      entries.push(entry)
    }

    windowEnd = windowStart - 1
  }

  entries.sort(
    (a, b) => b.blockNumber - a.blockNumber || b.logIndex - a.logIndex,
  )
  return entries
}
