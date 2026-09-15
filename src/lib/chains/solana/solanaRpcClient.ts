// Solana RPC client (getBalance/getTokenAccountsByOwner/getSignaturesForAddress/getTransaction) — implemented in Phase 3, per ARCHITECTURE.md §3.1/§7.
//
// A real-network smoke test found that "indexed" methods —
// `getTokenAccountsByOwner`, `getProgramAccounts` — 403 on every anonymous
// public endpoint (publicnode.com: "Indexed requests require a personal
// token"; ankr.com: premium-only), and even a free publicnode personal
// token, which turns out to need a paid hosted node to unlock indexed
// access. So this is no longer fully "keyless" per the original §3.1 plan
// (that doc is stale on this point) — the primary host is a free-tier
// Helius API key (10 req/s, no credit card), read from a build-time env
// var rather than committed to source so it isn't permanently baked into
// git history and can be rotated without a code change. It's still baked
// into the built client JS bundle at build time (Vite `VITE_*` behavior) —
// unavoidable for a fully static, backend-less app calling RPC directly
// from the browser. The key only rate-limits abuse to this account, it
// doesn't grant fund/account access. `solana-rpc.publicnode.com` is kept
// as an unauthenticated fallback for `getBalance`/`getSignaturesForAddress`/
// `getTransaction` (all confirmed working there) if Helius degrades, and
// as the only host at all if `VITE_HELIUS_API_KEY` isn't set (e.g. local
// dev without a `.env.local`) — in which case indexed methods will 403.

/** Legacy SPL Token program id. */
export const TOKEN_PROGRAM_ID = 'TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA'
/** Token-2022 program id. */
export const TOKEN_2022_PROGRAM_ID =
  'TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb'

const heliusApiKey: string | undefined = import.meta.env.VITE_HELIUS_API_KEY

/**
 * Solana JSON-RPC hosts, tried in order. See the module comment above for
 * why Helius is first when a key is configured. Never
 * `api.mainnet-beta.solana.com` — it 403s any browser `Origin` header
 * (§3.1).
 */
export const SOLANA_RPC_HOSTS = [
  ...(heliusApiKey
    ? [`https://mainnet.helius-rpc.com/?api-key=${heliusApiKey}`]
    : []),
  'https://solana-rpc.publicnode.com',
] as const

/** Lamports per SOL, for native-balance conversion. */
export const LAMPORTS_PER_SOL = 1_000_000_000

/** Index of the RPC host to try first on the next call (round-robin state). */
let preferredHostIndex = 0

/**
 * Resets the round-robin fallback state. Exposed for tests so each test can
 * start from a known host without leaking state across cases; harmless to
 * call in app code too (e.g. after a manual "retry" action).
 */
export function resetSolanaRpcHostRotation(): void {
  preferredHostIndex = 0
}

interface JsonRpcSuccess<T> {
  jsonrpc: '2.0'
  id: number | string
  result: T
}

interface JsonRpcFailure {
  jsonrpc: '2.0'
  id: number | string
  error: { code: number; message: string }
}

type JsonRpcResponse<T> = JsonRpcSuccess<T> | JsonRpcFailure

function isJsonRpcFailure<T>(body: JsonRpcResponse<T>): body is JsonRpcFailure {
  return 'error' in body
}

/** No explicit timeout here previously meant a degraded-but-not-instantly-
 * erroring host (slow response, not a fast 429/5xx) could hang a single
 * call indefinitely — harmless when only a handful of calls are ever made,
 * but the full-history backfill can issue well over a hundred sequential
 * batch requests, so one slow host turns into a multi-minute hang instead
 * of the round-robin fallback kicking in quickly. */
const RPC_TIMEOUT_MS = 8_000

async function fetchWithTimeout(url: string, body: unknown): Promise<Response> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), RPC_TIMEOUT_MS)
  try {
    return await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
  } finally {
    clearTimeout(timeout)
  }
}

/**
 * POSTs a JSON-RPC request to the first Solana RPC host that answers
 * successfully, starting at `preferredHostIndex` and rotating forward on a
 * network error or HTTP 429 (per §3.1's fallback plan). Throws only once
 * every configured host has been exhausted, or immediately on a well-formed
 * JSON-RPC application error (that host is reachable, the request itself is
 * invalid — retrying elsewhere would not help).
 */
async function rpcCall<T>(method: string, params: unknown[]): Promise<T> {
  let lastError: unknown

  for (let attempt = 0; attempt < SOLANA_RPC_HOSTS.length; attempt++) {
    const hostIndex = (preferredHostIndex + attempt) % SOLANA_RPC_HOSTS.length
    const host = SOLANA_RPC_HOSTS[hostIndex]

    let response: Response
    try {
      response = await fetchWithTimeout(host, { jsonrpc: '2.0', id: 1, method, params })
    } catch (err) {
      // Network error (offline, DNS failure, CORS rejection, timeout) — try
      // the next host.
      lastError = err
      continue
    }

    if (response.status === 429 || (!response.ok && response.status >= 500)) {
      lastError = new Error(
        `Solana RPC ${host} returned HTTP ${response.status} for ${method}`,
      )
      continue
    }

    if (!response.ok) {
      throw new Error(
        `Solana RPC ${host} returned HTTP ${response.status} for ${method}`,
      )
    }

    const body = (await response.json()) as JsonRpcResponse<T>
    if (isJsonRpcFailure(body)) {
      throw new Error(
        `Solana RPC ${method} error ${body.error.code}: ${body.error.message}`,
      )
    }

    // This host answered successfully — prefer it first next time.
    preferredHostIndex = hostIndex
    return body.result
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`All Solana RPC hosts failed for ${method}`)
}

/**
 * POSTs a single JSON-RPC *batch* request (one HTTP round-trip for many
 * calls) to the first host that answers, same host-fallback behavior as
 * `rpcCall`. A per-item application error (or a missing entry in the
 * response array — some hosts silently drop unsupported batch entries)
 * resolves that item to `null` rather than failing the whole batch; only a
 * network/HTTP/429 failure across every host throws. Order of the returned
 * array matches `calls`, not the order the host responded in.
 */
async function rpcBatchCall<T>(
  calls: Array<{ method: string; params: unknown[] }>,
): Promise<Array<T | null>> {
  if (calls.length === 0) return []

  const body = calls.map((call, index) => ({
    jsonrpc: '2.0' as const,
    id: index,
    method: call.method,
    params: call.params,
  }))

  let lastError: unknown

  for (let attempt = 0; attempt < SOLANA_RPC_HOSTS.length; attempt++) {
    const hostIndex = (preferredHostIndex + attempt) % SOLANA_RPC_HOSTS.length
    const host = SOLANA_RPC_HOSTS[hostIndex]

    let response: Response
    try {
      response = await fetchWithTimeout(host, body)
    } catch (err) {
      lastError = err
      continue
    }

    if (response.status === 429 || (!response.ok && response.status >= 500)) {
      lastError = new Error(
        `Solana RPC ${host} returned HTTP ${response.status} for batch request`,
      )
      continue
    }

    if (!response.ok) {
      throw new Error(
        `Solana RPC ${host} returned HTTP ${response.status} for batch request`,
      )
    }

    const parsed: unknown = await response.json()
    if (!Array.isArray(parsed)) {
      // Some hosts don't support batching at all and echo a single object
      // (or an error) back — treat as a total failure for this host and
      // let the caller fall back to per-item calls.
      lastError = new Error(`Solana RPC ${host} returned a non-batch response`)
      continue
    }

    const byId = new Map<number, JsonRpcResponse<T>>()
    for (const entry of parsed as JsonRpcResponse<T>[]) {
      if (typeof entry?.id === 'number') byId.set(entry.id, entry)
    }

    preferredHostIndex = hostIndex
    return calls.map((_, index) => {
      const entry = byId.get(index)
      if (!entry || isJsonRpcFailure(entry)) return null
      return entry.result
    })
  }

  throw lastError instanceof Error
    ? lastError
    : new Error('All Solana RPC hosts failed for batch request')
}

interface GetBalanceResult {
  context: { slot: number }
  value: number
}

/** Native SOL balance for `address`, in SOL (converted from lamports). */
export async function getSolBalance(address: string): Promise<number> {
  const result = await rpcCall<GetBalanceResult>('getBalance', [address])
  return result.value / LAMPORTS_PER_SOL
}

interface ParsedTokenAccountInfo {
  mint: string
  owner: string
  tokenAmount: {
    amount: string
    decimals: number
    uiAmount: number | null
    uiAmountString: string
  }
}

interface GetTokenAccountsByOwnerResult {
  value: Array<{
    pubkey: string
    account: {
      data: {
        parsed: {
          info: ParsedTokenAccountInfo
          type: string
        }
        program: string
      }
    }
  }>
}

export interface TokenBalanceSummary {
  mint: string
  uiAmount: number | null
}

/**
 * SPL + Token-2022 token account balances owned by `address`, via
 * `getTokenAccountsByOwner` filtered by each of the two token program ids
 * (§3.1). Only the wallet's own token accounts are ever enumerated — never
 * stake/vault/farm program accounts — so this is spot-only by construction.
 */
export async function getTokenBalances(
  address: string,
): Promise<TokenBalanceSummary[]> {
  const programIds = [TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID]

  const resultsByProgram = await Promise.all(
    programIds.map((programId) =>
      rpcCall<GetTokenAccountsByOwnerResult>('getTokenAccountsByOwner', [
        address,
        { programId },
        { encoding: 'jsonParsed' },
      ]),
    ),
  )

  return resultsByProgram.flatMap((result) =>
    result.value.map(({ account }) => ({
      mint: account.data.parsed.info.mint,
      uiAmount: account.data.parsed.info.tokenAmount.uiAmount,
    })),
  )
}

export interface SignatureInfo {
  signature: string
  slot: number
  err: unknown
  memo: string | null
  blockTime: number | null
  confirmationStatus?: string
}

/**
 * Recent transaction signatures for `address`, most recent first (§3.1).
 */
export async function getSignatures(
  address: string,
  limit = 20,
  before?: string,
): Promise<SignatureInfo[]> {
  return rpcCall<SignatureInfo[]>('getSignaturesForAddress', [
    address,
    before ? { limit, before } : { limit },
  ])
}

export interface ParsedAccountKey {
  pubkey: string
  signer: boolean
  writable: boolean
  source?: string
}

export interface ParsedTokenBalance {
  accountIndex: number
  mint: string
  owner?: string
  programId?: string
  uiTokenAmount: {
    amount: string
    decimals: number
    uiAmount: number | null
    uiAmountString: string
  }
}

export interface ParsedTransactionMeta {
  err: unknown
  fee: number
  preBalances: number[]
  postBalances: number[]
  preTokenBalances?: ParsedTokenBalance[]
  postTokenBalances?: ParsedTokenBalance[]
}

export interface ParsedTransactionResult {
  slot: number
  blockTime: number | null
  meta: ParsedTransactionMeta | null
  transaction: {
    signatures: string[]
    message: {
      accountKeys: ParsedAccountKey[]
    }
  }
}

/**
 * Full parsed transaction for `signature`, requested with
 * `encoding: "jsonParsed"` and `maxSupportedTransactionVersion: 0` per §3.1
 * so `meta.preTokenBalances`/`postTokenBalances`/`preBalances`/`postBalances`
 * are available for client-side swap diffing (see `deriveSwaps.ts`).
 * Returns `null` if the RPC host has no record of the signature (e.g. it
 * was pruned or never confirmed).
 */
export async function getParsedTransaction(
  signature: string,
): Promise<ParsedTransactionResult | null> {
  return rpcCall<ParsedTransactionResult | null>('getTransaction', [
    signature,
    { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0 },
  ])
}

const BATCH_CHUNK_SIZE = 20

/**
 * Parsed transactions for many signatures at once, batched ~20 per HTTP
 * request instead of one round-trip each — the difference between a full
 * history backfill taking seconds vs. minutes. If a host rejects batching
 * outright (the whole chunk throws), falls back to `getParsedTransaction`
 * one at a time for just that chunk so a single unfriendly host degrades
 * gracefully rather than failing the sync. A signature this host has no
 * record of (pruned/unconfirmed) resolves to `null`, matching
 * `getParsedTransaction`'s own contract.
 */
export async function getParsedTransactionsBatch(
  signatures: string[],
): Promise<Array<ParsedTransactionResult | null>> {
  const results: Array<ParsedTransactionResult | null> = []

  for (let i = 0; i < signatures.length; i += BATCH_CHUNK_SIZE) {
    const chunk = signatures.slice(i, i + BATCH_CHUNK_SIZE)
    try {
      const chunkResults = await rpcBatchCall<ParsedTransactionResult | null>(
        chunk.map((signature) => ({
          method: 'getTransaction',
          params: [
            signature,
            { encoding: 'jsonParsed', maxSupportedTransactionVersion: 0 },
          ],
        })),
      )
      results.push(...chunkResults)
    } catch {
      const perSignature = await Promise.all(
        chunk.map((signature) =>
          getParsedTransaction(signature).catch(() => null),
        ),
      )
      results.push(...perSignature)
    }
  }

  return results
}
