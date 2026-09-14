# native-portfolio — Architecture

A static, backend-less, client-side spot-portfolio tracker for Solana and BSC wallets, modeled visually/functionally on Jupiter's portfolio page, with one twist: the user chooses a **main currency** (default `SOL`) as the numeraire instead of being forced into USD everywhere. Deployed as a static site on GitHub Pages, built with GitHub Actions. No custom backend, no database — all "server-side" work that exists is a scheduled GitHub Action that commits static JSON into the repo.

**The repo must stay public.** GitHub Pages via GitHub Actions is free on the GitHub Free plan only for public repositories; a private repo requires a paid plan (Pro/Team/Enterprise) to get Pages. Since no secret ever needs to live in this repo (see §1), there is no cost to keeping it public, and it's required to keep the entire stack on GitHub Free.

---

## 1. Tech stack

Use the **latest stable major version** of every package below — do not pin exact versions in this document (they will drift); let `package.json` use caret ranges and keep CI green as the source of truth for what "latest" currently resolves to.

| Purpose | Package | Notes |
|---|---|---|
| UI framework | `react`, `react-dom` | function components + hooks only |
| Build tool / dev server | `vite`, `@vitejs/plugin-react` | |
| Language | `typescript` | strict mode on |
| Styling | `tailwindcss`, `@tailwindcss/vite` (or `postcss`/`autoprefixer` if the Vite plugin isn't used) | v4-style CSS-first config (`@theme` tokens), matching the design-token approach observed in the Jupiter teardown |
| Calendar heatmap | hand-rolled grid component (see §6) — **no external calendar-heatmap library**; the Jupiter grid is a bespoke 7-column flex/CSS-grid layout with custom color-intensity buckets that a generic heatmap lib (e.g. `react-calendar-heatmap`) does not reproduce cleanly. Avoid the extra dependency. |
| Charts (allocation bar / any future sparkline) | `visx` (`@visx/shape`, `@visx/scale`) *or* plain SVG/CSS — prefer plain CSS/SVG for the single stacked allocation bar and Recharts/visx only if a line/sparkline chart is added later. Keep as a soft dependency, added in Phase 4 only if needed. |
| URL-state compression | `fflate` (raw-deflate) | |
| Base64url codec | `js-base64` | isomorphic, no reliance on Node `Buffer` |
| Solana address codec | `bs58` | same library `@solana/web3.js` uses internally |
| Solana RPC calls | `@solana/web3.js` (or its lighter successor package if current at build time) | `getBalance`, `getTokenAccountsByOwner`, `getSignaturesForAddress`, `getTransaction` against public RPC, §3.1 |
| BSC/EVM RPC calls + ABI encoding | `viem` | `eth_call`/`eth_getLogs`/Multicall3 encoding against public RPC, §3.2 — prefer over `ethers` for smaller bundle size and native multicall helpers |
| Data fetching / caching | `@tanstack/react-query` | request de-dupe, retry/backoff, localStorage-backed cache persistence via `@tanstack/query-sync-storage-persister` + `@tanstack/react-query-persist-client` |
| Routing | none needed (single page, state lives in URL hash) — if multi-view routing is wanted later, `react-router` is the fallback choice, not adopted in Phase 2 |
| Linting/formatting | `eslint`, `typescript-eslint`, `prettier` | |
| Testing | `vitest`, `@testing-library/react`, `@testing-library/jest-dom` | |
| Icons | `@phosphor-icons/react` (bold weight, matching the observed `ph--*` iconify classes in the teardown) | |
| Date handling | `date-fns` (with `date-fns-tz` if UTC-day boundaries need explicit handling) | used for calendar month grids, `weekStartsOn: 1` |

No package should ever hold a secret, and — per §3.1/§3.2 — this app needs none: every chain data source is a keyless public JSON-RPC endpoint. There is no API key anywhere in the client bundle for Solana or BSC data.

---

## 2. Data flow (textual diagram)

```
┌──────────────┐   paste address(es) + pick    ┌───────────────────┐
│     User     │──────────────────────────────▶│  WalletManager UI  │
└──────────────┘   main currency (default SOL) └─────────┬─────────┘
                                                            │ encode()
                                                            ▼
                                            ┌───────────────────────────┐
                                            │ accountCodec: binary pack  │
                                            │  → deflate (fflate)        │
                                            │  → base64url (js-base64)   │
                                            └─────────────┬──────────────┘
                                                            │ write
                                                            ▼
                                     location.hash = "#a=<token>"   (+ mirrored to localStorage)
                                                            │
                              ── page load / hash change ──┘
                                                            ▼
                                            ┌───────────────────────────┐
                                            │ accountCodec.decode(token) │
                                            │  → {mainCurrency, wallets} │
                                            └─────────────┬──────────────┘
                                                            │
                        ┌───────────────────────────────────┼───────────────────────────────────┐
                        ▼                                   ▼                                   ▼
              ┌───────────────────┐               ┌───────────────────┐               ┌────────────────────┐
              │ Solana data layer │               │  BSC data layer    │               │ Price/history layer │
              │  public RPC:      │               │  public RPC:       │               │  DefiLlama coins.   │
              │  getTokenAccounts │               │  eth_call/Multicall│               │  llama.fi (point-in-│
              │  ByOwner + parsed │               │  + eth_getLogs     │               │  time + daily avg)  │
              │  tx diffing       │               │  (both keyless)    │               │  + Jupiter Price v3 │
              └─────────┬─────────┘               └─────────┬──────────┘               └──────────┬──────────┘
                        │ raw balances + tx history          │ raw balances + tx history            │ USD prices (now / at-t / daily-avg)
                        └───────────────────┬─────────────────┴──────────────────┬────────────────────┘
                                              ▼                                    ▼
                                  ┌─────────────────────────────────────────────────────┐
                                  │            PnL / currency-conversion engine          │
                                  │  (react-query cache, per §5 formulas)                │
                                  └─────────────────────────┬─────────────────────────────┘
                                                             ▼
                        ┌────────────────────────────────────────────────────────────────────┐
                        │                          React UI                                    │
                        │  HoldingsTable · AllocationBreakdown · ActivityTable · PnlCalendar    │
                        │  · CurrencySwitcher · WalletManager                                   │
                        └────────────────────────────────────────────────────────────────────┘

  (fallback path, all chains) — if a live API call fails/rate-limits, the app first serves the
  last react-query-persisted localStorage cache (marked "stale"), then, for a small fixed set of
  major tokens (SOL, BNB, USDC, USDT, JUP, CAKE, WBNB, WETH...), falls back to a static JSON
  snapshot at /snapshots/prices-latest.json committed to the repo by a scheduled GitHub Action
  (see §8) — this snapshot is served as a normal static asset from GitHub Pages, no server involved.
```

---

## 3. Chosen APIs per capability

Firm decisions, all confirmed browser-CORS-callable by the research agents (no proxy needed for any of these):

### 3.1 Solana balances + transaction history — **keyless public JSON-RPC** (`solana-rpc.publicnode.com`)
No API key anywhere in the Solana data path. All calls go to `POST https://solana-rpc.publicnode.com` (fallback mirror: any other public RPC that passes the same CORS test, e.g. a second publicnode-style endpoint, kept as a config-level list, not hardcoded to one host).
- Balances: `getBalance` for native SOL; SPL/Token-2022 balances via `getTokenAccountsByOwner` (filtered by each of the two token program IDs) — this only ever enumerates the wallet's own token accounts, never stake-program or vault/farm accounts (spot-only by construction, see §3.4).
- Transaction history: `getSignaturesForAddress` to list recent signatures, then `getTransaction(sig, { encoding: "jsonParsed", maxSupportedTransactionVersion: 0 })` per signature. The parsed result's `meta.preTokenBalances`/`meta.postTokenBalances` (per `mint`+`owner`, keyed by `accountIndex`) and `meta.preBalances`/`meta.postBalances` (native SOL lamports, parallel to `transaction.message.accountKeys`) are diffed client-side to derive each leg's token delta — the same underlying technique paid "enhanced transaction" APIs use internally, just done in-app instead of server-side. A transaction is classified as a swap when the wallet's own owner-index shows one negative-delta mint and one positive-delta mint in the same transaction (see the two-sided-transfer rule in §3.4).
- CORS: confirmed directly (`access-control-allow-origin: *` returned on both a plain `getHealth` call and a real `getTransaction` call, tested with an explicit browser `Origin` header) for `solana-rpc.publicnode.com`.
- Explicitly **not used**: `api.mainnet-beta.solana.com` — confirmed (`curl` with vs. without an `Origin` header) to return **403** the instant a browser `Origin` header is present, despite the response otherwise looking CORS-friendly. Never call this host from the browser.
- Rate limit / fallback plan: no published hard SLA (best-effort shared public infrastructure); 10 rapid sequential test calls all returned 200 with no observed throttling, comfortably sufficient for dozens-of-users/day hobby scale. Add client-side request de-dup/backoff (react-query default retry/backoff is sufficient) since it's shared community infrastructure, not a dedicated quota. If one public RPC host degrades, round-robin to the next entry in the configured fallback list before showing a stale-cache badge.

### 3.2 BSC balances + transaction history — **keyless public JSON-RPC** (`bsc-rpc.publicnode.com`)
No API key anywhere in the BSC data path either — BscScan/Etherscan V2 (BNB Smart Chain is paid-tier-only as of the current free-tier cut, confirmed live) and Ankr's public endpoint (now requires a key) are both explicitly **not used**.
- Native BNB balance: standard `eth_getBalance` JSON-RPC call.
- BEP-20 balances (spot only): `eth_call` to each token contract's `balanceOf(address)`, batched via the **Multicall3** contract (`0xcA11bde05977b3631167028862bE2a173976CA11`, confirmed deployed on BSC) against a maintained, curated list of common token contracts in `src/config/chains.ts` (`bscKnownTokens`) — there is no free "list every token this wallet holds" indexer endpoint, so the app can only show balances for tokens on this curated list plus any token the user explicitly adds by contract address. This is a real coverage limitation vs. Solana's DAS-style full enumeration; document it in the UI (an "add custom token" affordance) and in §10.
- Transaction/swap history: `eth_getLogs` for the ERC-20/BEP-20 `Transfer` event topic, filtered **per known token contract address** (the public node rejects a broad topic-only scan with `-32701`), with the wallet's address padded into `topics[1]`/`topics[2]`, over bounded block ranges (public nodes cap around a ~5,000-block window per call, so history fetching paginates backwards in windows). Each returned log includes `blockTimestamp` directly (no extra per-block lookup needed); the raw amount is in `data` and must be divided by that token's own `decimals()` (fetched once and cached). A swap is derived the same way as Solana: same transaction hash showing one outgoing and one incoming Transfer for the wallet's own address (see §3.4).
- CORS: confirmed directly (`access-control-allow-origin: *` on both the RPC call and its preflight) for `bsc-rpc.publicnode.com`, tested with an explicit browser `Origin` header.
- Rate limit / fallback plan: same posture as §3.1 — best-effort shared public infra, no documented hard cap, 10 rapid sequential calls all returned 200. Keep a small fallback list (e.g. a second public BSC RPC) to round-robin to if the primary degrades.

### 3.3 Historical price lookup (both chains, any token) — **DefiLlama free Coins API**
- Point-in-time price at an exact transaction timestamp: `GET https://coins.llama.fi/prices/historical/{unixTimestamp}/{coin}`.
- Daily average (for the PnL calendar's "avg" subtext and for converting a day's aggregate PnL into main-currency units): `GET https://coins.llama.fi/chart/{coin}?start={unixTimestampOfUTCDayStart}&span=24&period=1h` → average the 24 returned hourly points client-side.
- `{coin}` identifiers: natives use `coingecko:solana` / `coingecko:binancecoin`; any SPL/BEP-20 token uses `{chain}:{contractAddress}` (`solana:<mint>` / `bsc:<address>`).
- CORS: confirmed open (`access-control-allow-origin` reflects request origin; OPTIONS preflight succeeds).
- Key handling: none — fully keyless, safe to call directly from the browser.
- Rate limit / fallback plan: no published hard cap, no throttling observed in testing; still, cache every historical price lookup permanently in `localStorage`/IndexedDB keyed by `(coin, unixTimestamp rounded to hour)` since historical prices never change once fetched — this both protects against future rate limiting and avoids redundant calls entirely. If DefiLlama is unreachable, fall back to the committed `/snapshots/prices-latest.json` for the fixed major-token watchlist (SOL, BNB, USDC, USDT, JUP, CAKE, WBNB, WETH); prices for obscure/long-tail tokens with no snapshot entry and no cache simply render as "price unavailable" rather than silently using the wrong (current) price — this is a hard rule, see §5.
- Current/live USD pricing (used only for "current value" holdings display, never for historical PnL) uses **Jupiter Price API v3** (`GET https://lite-api.jup.ag/price/v3?ids=<mint1>,<mint2>,...`) for Solana-side tokens where available (keyless, confirmed CORS, dynamically reflects request origin), and **DefiLlama's `/prices/current/{coin}` endpoint** (keyless, same as the historical lookups) for BSC-side tokens and any Solana token Jupiter doesn't price.
- Explicitly **not used** for historical data: CoinGecko free tier (hard-blocks lookups older than 365 days) and Birdeye (requires a key even for price lookups, Solana-only).

### 3.4 Spot-only isolation rule (applies to both chains)
**Balances:** only sum balances returned by: Solana → DAS `getAssetsByOwner` (native SOL + SPL/Token-2022 accounts only); BSC → chosen BSC provider's direct wallet-token-balance endpoint (on-chain token balances only, see §3.2). Never additionally query the Solana Stake program, any Solana vault/farm program's `getProgramAccounts`, or a DeFi-positions endpoint. This is sufficient by construction to exclude staking/yield/airdrop-locked *positions* — no further filtering logic is required beyond an optional `possible_spam`/known-scam-token filter.

**Activity feed (separate rule — balances filtering does NOT filter the tx-history feed):** a plain incoming transfer with no matching outgoing leg (an airdrop landing directly in the wallet, or a direct receive) is indistinguishable from a real trade at the balance level, and will appear as a normal `TRANSFER`-type row in both chains' tx-history APIs unless explicitly excluded. The `ActivityTable` (§6) MUST filter tx-history entries to only those classified as a genuine two-sided swap/trade (a `SWAP` type, or a `TRANSFER` pair with both an outgoing and incoming leg in the same transaction); a one-sided incoming `TRANSFER` with no matching outgoing leg in that transaction (airdrop, gift, direct receive) is excluded from the Activity view, though it still correctly contributes to the wallet's spot balance total via the balances path above.

---

## 4. State encoding spec

**Where it lives:** URL **hash fragment**, single-letter key: `https://<host>/#a=<token>`. Never a query param (avoids server/CDN access-log exposure, avoids clashing with any future query-string use, updates via `history.replaceState` without a page reload or history-stack pollution).

**Schema (TS shape, pre-encoding):**
```ts
type ChainId = "solana" | "bsc"; // extensible: add more chain tags later

interface WalletEntry {
  chain: ChainId;
  address: string;      // base58 (solana) or 0x-hex (bsc) in the decoded, in-memory shape
  label?: string;        // optional user-given nickname
}

interface AppState {
  version: number;              // schema version byte, for forward migrations
  mainCurrency: string;         // dictionary index in binary form; e.g. "SOL" | "BNB" | "USDC" | "USD" ...
  wallets: WalletEntry[];
}
```

**Binary wire format (what actually gets deflated/base64url'd):**
```
[version: u8]
[mainCurrencyDictIndex: u8]      // small fixed dictionary of supported currencies; unknown → fallback index
[walletCount: u16]
repeated walletCount times:
  [chainId+hasLabelFlag: u8]     // 1 byte: low bits = chain enum, top bit = "has label"
  [rawAddressBytes]              // 32 bytes (solana, decoded from base58 via `bs58`) or 20 bytes (bsc, decoded from hex)
  [optional: labelLength: u8][labelUtf8Bytes]
```
Addresses are decoded to raw bytes **before** compression — this is the dominant size win, since base58/hex text is high-entropy and gzip/deflate barely shrinks it. The packed binary is then run through `fflate` raw-deflate and encoded with `js-base64` base64url (alphabet strictly `[A-Za-z0-9_-]`, no `+`/`/`/`=`, safe to drop into a URL hash with zero escaping).

**Encode/decode approach:**
- `encode(state: AppState): string` — pack → deflate → base64url.
- `decode(token: string): AppState` — base64url-decode → inflate → unpack; wrapped in try/catch everywhere it's called.
- Lives in `src/lib/encoding/accountCodec.ts` (ported directly from the verified scratch implementation at `/home/plungarini/native-portfolio/scratch-encode/accountCodec.mjs`, converted from `.mjs`+JSDoc to `.ts`).

**localStorage mirroring behavior:**
1. On app start, read `location.hash`. If a token is present: `decode()` it, use as initial state, and write that same raw token string to `localStorage.setItem('portfolio.account', token)`.
2. If no hash token is present (bare-domain bookmark): read `localStorage.getItem('portfolio.account')`, decode it, and immediately re-write it into `location.hash` via `history.replaceState` so the URL becomes shareable again.
3. On every state mutation (add/remove wallet, change main currency): re-`encode()`, then update both `location.hash` (`history.replaceState`, never `pushState`) and `localStorage` synchronously in the same tick.
4. A `decode()` failure (corrupted/truncated/hand-edited hash) falls back to the localStorage copy rather than crashing the app; if that also fails, fall back to an empty `AppState` and show the WalletManager's empty/onboarding state.

**Max practical watchlist size:** verified round-trip at 20 realistic (high-entropy) wallets+labels → ~1050 chars, well under a ~2000-char safe URL budget. Growth is roughly **linear** at this address mix (~28–30 encoded chars per labeled wallet) — deflate cannot meaningfully compress high-entropy address bytes, so size does not shrink at scale. Extrapolating: ~50 wallets ≈ 1,950 chars, ~100 wallets ≈ 3,800 chars (over budget). **Practical soft cap: 60 wallets** (~1,800 chars), with a UI warning starting around 50 wallets; a hard stop or an opt-in "long URL, may not work in all contexts" acknowledgment past ~65–70 wallets.

---

## 5. Currency conversion & PnL computation rules

Let `mainCurrency` be the user's chosen numeraire (default `SOL`). All three rules below use USD purely as an internal bridge currency for cross-token conversion — it is never itself the thing displayed as "the" value unless it's shown in parens as the secondary figure.

### 5.1 Holdings / current value
For each held token `h` (any token in any wallet, aggregated):
```
usdValue(h)            = h.amountToken * currentUsdPrice(h.token)          // "live" price, §3.3
mainCurrencyValue(h)    = usdValue(h) / currentUsdPrice(mainCurrency)       // also "live" price — both sides same instant
display(h) = `${format(mainCurrencyValue(h))} ${mainCurrency.symbol} (~$${format(usdValue(h))})`
```
Example: holding is 12.4 SOL, mainCurrency = SOL → `mainCurrencyValue = 12.4` trivially, `usdValue = 12.4 * currentUsdPrice(SOL)` → **"12.4 SOL (~$1,860)"**. For a non-main-currency holding (e.g. USDC while mainCurrency = SOL), both the numerator and denominator use the *current* price so the parenthetical USD figure and the main-currency figure are always mutually consistent at "now".

### 5.2 PnL calendar (per day cell)
For a given UTC calendar day `D`:
```
dailyPnlUsd(D)          = Σ realizedPnlUsd(trade) for every trade executed on day D
                           // each trade's PnL already computed in USD using THAT trade's
                           // own historical price at its own timestamp, per §5.3 — never
                           // recomputed with a day-level or current price
mainCurrencyAvgUsd(D)   = average(24 hourly USD prices of mainCurrency on day D)   // DefiLlama /chart, §3.3
dailyPnlMainCurrency(D) = dailyPnlUsd(D) / mainCurrencyAvgUsd(D)

cell.big   = `${sign}${format(dailyPnlMainCurrency(D))} ${mainCurrency.symbol}`   // e.g. "+1.2 SOL"
cell.small = `$${format(mainCurrencyAvgUsd(D))} avg`                              // e.g. "$148 avg"
```
Critically, `mainCurrencyAvgUsd(D)` is **that day's historical average**, not the current live price of `mainCurrency` — this is the exact conversion rate used to turn the day's USD PnL into main-currency units, and it is also literally what's printed as the small subtext, so the two numbers are self-consistent and auditable by the user.

### 5.3 Activity / trade history (per transaction)
For a transaction `tx` at unix timestamp `t`:
```
priceUsdAtT(token)   = historicalPriceLookup(token, t)     // DefiLlama /prices/historical/{t}/{coin}, §3.3
tx.valueUsd          = tx.amountToken * priceUsdAtT(tx.token)
tx.valueMainCurrency = tx.valueUsd / priceUsdAtT(mainCurrency)   // same tx timestamp `t` on both sides
```
Realized PnL per sell/swap-out leg uses **FIFO cost-basis lot matching**: each buy leg opens a lot at `priceUsdAtT(buy)`; each sell leg closes the oldest open lot(s) first; `realizedPnlUsd(tx) = tx.valueUsd - costBasisUsd(matched lots)`. This is the `realizedPnlUsd(trade)` figure summed in §5.2.

**Hard rule, never violated:** the *current* live price (§3.3's "current pricing" sources) is used **only** in §5.1 (holdings display). Every PnL figure anywhere in the app — activity rows, per-day calendar cells, monthly/all-time summaries — is built exclusively from historical prices at the relevant historical instant (per-trade timestamp) or historical daily average (per-day calendar), sourced from DefiLlama's historical endpoints, never the current-price endpoints.

---

## 6. Component inventory (mapped to the Jupiter teardown)

The teardown's ground truth is that "holdings cards" are actually rendered as a **table** (`TableSection` + `Table` primitives), not a card grid — component names below keep the familiar names from the spec but implement Jupiter's real table-based layout, not a card grid.

| Component | Data needed | Styling note (from teardown) |
|---|---|---|
| **`TableSection`** (shared primitive, used by Holdings/Activity) | n/a — layout shell | `rounded-2xl` panel (`max-sm:rounded-none`, edge-to-edge via `-mx-5` on mobile); header strip `bg-border/50 rounded-xl px-4 py-2` with title + count/value pill badge (`bg-border/70 rounded-full px-2.5 py-1`); body `px-3 pb-2.5` |
| **`HoldingsTable`** (aka "HoldingsCard" in spec — implemented as a table) | Per-token: symbol, icon, `amountToken`, `mainCurrencyValue`, `usdValue`, `currentUsdPrice`, 24h % change, per-token PnL | Columns: Asset (270px fixed) · Value/Balance · Price/24hΔ · PnL · Actions. Asset cell: 28px rounded-full icon + symbol. Value cell: main-currency value `text-sm font-medium text-foreground` on top, USD-in-parens `text-xs text-muted-foreground` below (inverted from Jupiter's USD-primary layout to match this app's main-currency-first requirement). 24h Δ colored `text-success #35d399` / `text-destructive #fb7185`. Row hover `hover:bg-muted/50` (`--muted: #212a36`). Header cells `h-12 text-xs font-light text-muted-foreground`. |
| **`AllocationBreakdown`** | Per-token % of total portfolio value | Chip legend (28px icon, 2px colored ring) + single `h-[18px] rounded` stacked bar, `gap-px` between segments, diagonal-stripe `opacity-20` texture overlay; caption "N tokens detected" |
| **`ActivityTable`** | Per-tx: timestamp, protocol/app name+logo, token(s) received/sent with amounts, `valueUsd`/`valueMainCurrency` at tx time (§5.3), tags (Failed/Spam), tx hash link | One `TableSection` per calendar day, section header = date + "N activities" pill. Columns: Time (w-28) · App · Received · Sent · Tags · Tx (w-16). Received/sent lines colored `text-success`(+)/`text-destructive`(-). Filters: "Hide failed"/"Hide spam" toggles + Export (CSV) + Refresh icon button. Infinite scroll (5 pages) then "Load More". No airdrop/staking rows ever appear — filtered by the swap/two-sided-transfer classification rule in §3.4 |
| **`PnlCalendar`** | Per day: `dailyPnlMainCurrency(D)`, `mainCurrencyAvgUsd(D)` (§5.2), trade count/volume for tooltip | Modal/drawer, opened from a "Calendar" button. Month nav strip with caret icons + clickable month label. Monthly summary strip: thin 2-color proportional bar (green=profit-day %, red=loss-day %) + "Profit days N / value" / "Loss days N / value". 7-col weekday header (`weekStartsOn: 1`), day cells `aspect-square` (mobile), day number pinned top-left at 50% opacity, PnL big-text centered, avg-price small-text below it. **3-tier opacity heatmap** keyed to `|dailyPnlUsd(D)|` magnitude (not main-currency magnitude, to stay consistent with Jupiter's USD-bucketed thresholds): none/$0 → `bg-transparent`; <$10 → `/5`; $10–100 → `/10`; ≥$100 → `/15` (hover one tier brighter), same `--success #35d399`/`--destructive #fb7185` hues |
| **`CurrencySwitcher`** | List of supported main currencies (SOL, BNB, USDC, USD, ...) | Small pill/segmented toggle, same visual pattern as Jupiter's USD⟷native pill toggle on the PnL calendar/cards — reused site-wide since this app's switcher is global, not per-widget |
| **`WalletManager`** | Current `wallets[]` from decoded state; add/remove/label actions | Wallet name+avatar trigger opens a switcher; multi-wallet view shows a "N wallets" chip with checklist popover to include/exclude wallets, matching Jupiter's bundle selector pattern |
| **`Tabs`** (Holdings / Activity — no Positions/Airdrop tabs, spot-only per spec) | n/a | Underline tab nav, active tab gets a 24px-wide 2px-tall `bg-primary` (`#c7f284`) pill indicator centered under the label |
| **Shared design tokens** | n/a | Background layers `#090d10`→`#0d151e`→`#151e28`→`#212a36`→`#19242e` (bg→card→input→muted→border); text `#e2e8f0`/`#cad5e2`/`#90a1b9`/`#67778e`; accent `#c7f284`; success `#35d399`; destructive `#fb7185`; font Inter (300–700); radii `xs2px..4xl32px` with `2xl`(cards)/`xl`(section headers)/`full`(pills/avatars); icons Phosphor Bold |

---

## 7. File/folder structure

```
native-portfolio/
├── .github/
│   └── workflows/
│       ├── ci.yml
│       ├── deploy.yml
│       └── price-snapshot.yml
├── public/
│   ├── snapshots/
│   │   └── prices-latest.json        # committed by the scheduled Action, served as a static asset
│   └── favicon.svg
├── scripts/
│   └── fetch-price-snapshot.ts        # run only inside the price-snapshot.yml Action, node/tsx
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── components/
│   │   ├── ui/                        # TableSection, Table, Badge, Pill, Tooltip, Skeleton, Modal
│   │   ├── HoldingsTable/
│   │   ├── AllocationBreakdown/
│   │   ├── ActivityTable/
│   │   ├── PnlCalendar/
│   │   ├── CurrencySwitcher/
│   │   ├── WalletManager/
│   │   └── Tabs/
│   ├── lib/
│   │   ├── encoding/
│   │   │   ├── accountCodec.ts
│   │   │   ├── urlState.ts            # hash read/write, history.replaceState
│   │   │   └── storagePersistence.ts  # localStorage mirror, per §4
│   │   ├── chains/
│   │   │   ├── solana/
│   │   │   │   ├── solanaRpcClient.ts       # getBalance/getTokenAccountsByOwner/getSignaturesForAddress/getTransaction
│   │   │   │   └── deriveSwaps.ts           # pre/post balance diffing → swap classification
│   │   │   └── bsc/
│   │   │       ├── bscRpcClient.ts          # eth_call/eth_getLogs + Multicall3 batching
│   │   │       └── deriveSwaps.ts           # Transfer-log diffing → swap classification
│   │   ├── prices/
│   │   │   ├── defillama.ts
│   │   │   ├── jupiterPriceV3.ts
│   │   │   ├── historicalPriceCache.ts   # permanent localStorage/IndexedDB cache keyed by (coin, hour)
│   │   │   └── snapshotFallback.ts       # reads /snapshots/prices-latest.json
│   │   ├── pnl/
│   │   │   ├── fifoCostBasis.ts
│   │   │   └── calendarAggregation.ts
│   │   └── format/
│   │       ├── currency.ts
│   │       └── number.ts
│   ├── hooks/
│   │   ├── useWallets.ts
│   │   ├── useHoldings.ts
│   │   ├── useActivity.ts
│   │   └── usePnlCalendar.ts
│   ├── types/
│   │   ├── state.ts                   # AppState/WalletEntry, §4
│   │   └── chain.ts
│   ├── config/
│   │   ├── currencies.ts              # supported main-currency dictionary
│   │   └── chains.ts
│   └── styles/
│       └── tokens.css                 # Tailwind v4 @theme tokens, §6 palette
├── tests/                             # or colocated *.test.ts next to source
├── index.html
├── vite.config.ts
├── tailwind.config.ts                 # or CSS-first config if fully on Tailwind v4 @theme
├── tsconfig.json
├── package.json
├── ARCHITECTURE.md
└── README.md
```

---

## 8. GitHub Actions plan

Three workflows, all under `.github/workflows/`. **Pin every action below to its current latest major version tag, verified against the GitHub Marketplace listing at implementation time — do not assume a version from memory or training data (e.g. do not assume `actions/deploy-pages@v1`; confirm the currently-latest major and that it is not marked deprecated).** This mirrors the freshness policy §1 applies to npm packages.

### 8.1 `ci.yml` — lint/typecheck/test, on every push and PR
- `actions/checkout` — check out the repo.
- `actions/setup-node` — provision Node with the project's npm cache enabled.
- `npm ci` — install exact locked deps.
- `npm run lint` (ESLint), `npm run typecheck` (`tsc --noEmit`), `npm test` (Vitest), `npm run build` (Vite build, as a build-health check even though this workflow doesn't deploy).

### 8.2 `deploy.yml` — build + publish to GitHub Pages, on push to `main`
- `actions/checkout`.
- `actions/setup-node`.
- `npm ci` then `npm run build` (Vite outputs to `dist/`).
- `actions/configure-pages` — prepares the Pages environment/base-path config.
- `actions/upload-pages-artifact` — uploads `dist/` as the Pages artifact.
- `actions/deploy-pages` — publishes the artifact.
- Needs `permissions: pages: write, id-token: write` and `environment: github-pages` at the job level, per standard Pages-deploy convention.

### 8.3 `price-snapshot.yml` — scheduled static-JSON fallback cache
- Triggered on a `schedule: cron` (e.g. every 6 hours) plus `workflow_dispatch` for manual runs.
- `actions/checkout`, `actions/setup-node`, `npm ci`.
- Runs `scripts/fetch-price-snapshot.ts` (tsx/node): calls DefiLlama's current-price endpoint for a fixed watchlist (SOL, BNB, USDC, USDT, JUP, CAKE, WBNB, WETH, ...) and writes `public/snapshots/prices-latest.json`.
- Commits the updated file directly back to `main` (a bot commit using the default `GITHUB_TOKEN`) if it changed; the next `deploy.yml` run (or the existing live site, since it's a plain static asset) picks it up.
- This is the sanctioned "workaround" for GitHub Pages having no live backend: a periodic Action keeping a static cache warm, used purely as an offline/rate-limited fallback layer, never as the primary data path.

---

## 9. Phased build plan

### Phase 2 — Scaffold + encoding + CI skeleton
- Vite + React + TS scaffold, Tailwind wired with the §6 token palette, ESLint/Prettier/Vitest configured.
- Port `accountCodec.ts` from the verified scratch implementation; implement `urlState.ts` + `storagePersistence.ts` per §4.
- `ci.yml` and `deploy.yml` committed and green on a placeholder page.
- **Automated tests:** round-trip encode/decode for 0, 1, 20, 100 wallets (assert lossless `deepEqual`); decode-failure fallback path (corrupted token → falls back to localStorage, then to empty state, never throws); token alphabet is `[A-Za-z0-9_-]` only; hash-vs-localStorage precedence (hash wins when both present).
- **Manual checklist:** load bare domain → onboarding state shown; add a wallet → URL hash updates without a page reload/history entry; refresh page → same state restored from hash; clear hash manually → state restored from localStorage and hash is rewritten; CI badge green on GitHub; Pages deploy live and reachable.

### Phase 3 — Data layer per chain
- Implement `solanaRpcClient.ts` + `deriveSwaps.ts` (Solana), `bscRpcClient.ts` + `deriveSwaps.ts` (BSC), `defillama.ts`, `jupiterPriceV3.ts`, all wrapped in react-query hooks with persisted cache.
- Implement `historicalPriceCache.ts` (permanent keyed cache) and `snapshotFallback.ts`.
- **Automated tests:** each client mocked via MSW/fetch-mock — assert correct URL/params built, correct parsing of a fixture response, and correct fallback trigger on a simulated 429/5xx; FIFO cost-basis unit tests with hand-computed lot-matching scenarios; calendar day-average computation against a fixed 24-point fixture.
- **Manual checklist:** paste a real Solana wallet with known holdings → balances match a block explorer; paste a real BSC wallet with a known token from the curated list → same; kill network mid-request → stale-cache badge appears, no crash; temporarily point the primary RPC host at an unreachable URL → the configured fallback RPC host engages and is visibly labeled as degraded.

### Phase 4 — UI components
- Build `ui/` primitives (`TableSection`, `Table`, `Badge`, `Tooltip`, `Skeleton`, `Modal`) matching §6 tokens; then `HoldingsTable`, `AllocationBreakdown`, `ActivityTable`, `PnlCalendar`, `CurrencySwitcher`, `WalletManager`, `Tabs`, all against static/fixture data (no live API wiring yet).
- **Automated tests:** RTL render tests per component (renders expected columns/labels, correct color class applied for positive/negative PnL, calendar heatmap bucket assigned correctly for `<$10`/`$10-100`/`≥$100` fixtures, empty-state renders when no data).
- **Manual checklist:** visually compare each component side-by-side with the real jup.ag/portfolio page (colors, spacing, radii, font sizes) using the palette/type-scale table in §6; verify skeleton loading states appear before data resolves; verify tooltips on truncated/compact values.

### Phase 5 — Integration + currency logic
- Wire live data hooks into all components; implement §5's three formula sets end-to-end (`useHoldings`, `usePnlCalendar`, `useActivity`); implement `CurrencySwitcher` driving `mainCurrency` through the whole tree and re-encoding URL state on change.
- **Automated tests:** integration test that changing `mainCurrency` updates HoldingsTable's main-currency column but leaves the USD parenthetical unchanged for a fixed fixture; PnL calendar cell big/small text matches hand-computed §5.2 values for a scripted day of trades; ActivityTable row's USD/main-currency value matches §5.3 exactly for a known historical timestamp (cross-checked against a manually looked-up DefiLlama value).
- **Manual checklist:** switch main currency live and confirm every widget updates consistently and instantly (from cached prices, no full reload); confirm a holdings row for the main-currency token itself renders as `"X SOL ($Y)"` with no double-conversion rounding drift; confirm activity rows for an old (>1yr) transaction still resolve a price (proving DefiLlama's no-lookback-limit advantage vs CoinGecko is actually exercised).

### Phase 6 — Visual/interactive verification against the real Jupiter page
- Side-by-side manual pass against the live `jup.ag/portfolio` page (with a real wallet) for every component: color values (use dev-tools computed-style, not eyeballing), spacing/radius, typography scale, hover/active states, tooltip behavior, skeleton shapes, tab underline indicator, calendar heatmap tiering, allocation bar rendering.
- **Automated tests:** visual regression snapshots (e.g. Playwright screenshot diffing) for each component's light/loading/populated/empty states, run in CI on PRs touching `src/components/`.
- **Manual checklist:** full click-through of the deployed GitHub Pages site on both desktop and mobile widths; verify no airdrop/staking/positions UI is present anywhere; verify the state-in-URL is actually shareable (copy the link, open in a fresh incognito window, same portfolio loads); verify the scheduled snapshot fallback (`price-snapshot.yml`) has run at least once and `public/snapshots/prices-latest.json` is fresh in the deployed site.

---

## 10. Known risks / open questions

- **Shared public RPC reliability:** both Solana and BSC data paths depend on best-effort, no-SLA public RPC infrastructure (`solana-rpc.publicnode.com`, `bsc-rpc.publicnode.com`) — no API key at all means no per-app quota, but also no contractual guarantee. Mitigated by configuring a short fallback list of alternate public endpoints per chain (round-robin on failure) and always serving the persisted cache with a "stale" badge before erroring. Revisit if usage grows enough to get noticeably throttled: options are adding more fallback hosts, or (as a last resort within the "no backend" constraint) standing up a lightweight self-hosted RPC-proxy/cache, a deliberate documented exception to "no backend" if ever needed.
- **BSC token coverage is curated, not exhaustive:** unlike Solana's `getTokenAccountsByOwner` (which enumerates every SPL token account a wallet owns), BSC balances are only checked for tokens in a maintained list (`src/config/chains.ts`) plus any token the user explicitly adds by contract address — there is no free "list every token this wallet holds" indexer for BSC. A wallet holding an obscure BEP-20 token not on the list and not manually added will show an incomplete balance total. Mitigate with a reasonably broad default list (top ~50-100 BSC tokens by volume) and a clear "add custom token" UI affordance; not exhaustively solvable within the no-key constraint.
- **Historical price coverage for obscure/long-tail tokens:** DefiLlama's `{chain}:{contractAddress}` lookup only works for tokens it has indexed a price feed for; brand-new or extremely illiquid tokens may return no data at all for some historical timestamps. Per the hard rule in §5.3, such cases must render "price unavailable" rather than silently substituting the current price — this means some activity rows / PnL-calendar days may be incomplete for portfolios holding very obscure tokens. No mitigation beyond that is planned for v1.
- **"Spot-only" balance assumption:** relies on the empirical claim that staked/farmed/vault positions are held by a different program/contract's account, not the wallet's own token account (Solana) or the wallet's own address (BSC). This is correct for the common cases (Marinade-style LSTs, standard masterchef farms) but has not been exhaustively verified against every possible BSC/Solana staking protocol; an unusual protocol that mints a receipt token directly into the user's own wallet-owned account would incorrectly appear as a "spot" holding. Treat as a known edge case, not exhaustively guarded against in v1.
- **Client-side swap derivation correctness:** deriving swaps by diffing pre/post balances (rather than relying on a provider's own "type: SWAP" classification) is a standard, well-understood technique, but must correctly handle multi-hop swaps (>2 non-zero deltas in one transaction) and wrapped-SOL vs. native-SOL bookkeeping on Solana. Phase 3's automated tests must cover these cases explicitly with real fixture transactions, not just simple 2-leg swaps.
- **FIFO cost-basis choice:** the PnL spec did not mandate a specific accounting method; FIFO was chosen as the most common/expected default for retail portfolio trackers. This is a product decision that should be revisited (and potentially made user-selectable, e.g. FIFO vs average-cost) if user feedback indicates a preference.
- **Multi-chain extensibility:** the `ChainId` enum, per-chain client folders under `src/lib/chains/`, and the encoding schema's `chain` byte are all designed to make adding a third chain (e.g. Ethereum, Base) additive rather than a rewrite — but no third chain's data provider has actually been researched yet; doing so is out of scope until requested.
