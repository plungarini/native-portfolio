// Fetches current USD prices for the curated watchlist from DefiLlama's free Coins API
// and writes them to public/snapshots/prices-latest.json.
//
// This is the "sanctioned workaround" static-cache fallback described in ARCHITECTURE.md §8.3:
// it is run on a schedule by .github/workflows/price-snapshot.yml, never as the primary data path.
//
// Run locally with: npx tsx scripts/fetch-price-snapshot.ts

import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const DEFILLAMA_CURRENT_PRICE_URL = "https://coins.llama.fi/prices/current";

// Symbol -> CoinGecko id, as consumed by DefiLlama's `coingecko:<id>` coin key format.
const WATCHLIST: Record<string, string> = {
  SOL: "solana",
  BNB: "binancecoin",
  USDC: "usd-coin",
  USDT: "tether",
  JUP: "jupiter-exchange-solana",
  CAKE: "pancakeswap-token",
  WBNB: "wbnb",
  WETH: "weth",
};

interface DefiLlamaCoin {
  price: number;
  symbol: string;
  timestamp: number;
  confidence: number;
}

interface DefiLlamaResponse {
  coins: Record<string, DefiLlamaCoin>;
}

interface PriceSnapshotEntry {
  usd: number;
  symbol: string;
  coingeckoId: string;
  timestamp: number;
}

interface PriceSnapshot {
  generatedAt: string;
  prices: Record<string, PriceSnapshotEntry>;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const OUTPUT_PATH = path.join(REPO_ROOT, "public", "snapshots", "prices-latest.json");

async function fetchCurrentPrices(): Promise<PriceSnapshot> {
  const coinKeys = Object.values(WATCHLIST).map((id) => `coingecko:${id}`);
  const url = `${DEFILLAMA_CURRENT_PRICE_URL}/${coinKeys.join(",")}`;

  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`DefiLlama request failed: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as DefiLlamaResponse;

  const prices: Record<string, PriceSnapshotEntry> = {};
  for (const [symbol, coingeckoId] of Object.entries(WATCHLIST)) {
    const coin = data.coins[`coingecko:${coingeckoId}`];
    if (!coin) {
      throw new Error(`DefiLlama response missing price for ${symbol} (coingecko:${coingeckoId})`);
    }
    prices[symbol] = {
      usd: coin.price,
      symbol: coin.symbol,
      coingeckoId,
      timestamp: coin.timestamp,
    };
  }

  return {
    generatedAt: new Date().toISOString(),
    prices,
  };
}

async function readExistingSnapshot(): Promise<PriceSnapshot | null> {
  try {
    const raw = await readFile(OUTPUT_PATH, "utf-8");
    return JSON.parse(raw) as PriceSnapshot;
  } catch {
    return null;
  }
}

function pricesEqual(a: PriceSnapshot["prices"], b: PriceSnapshot["prices"]): boolean {
  const aKeys = Object.keys(a);
  const bKeys = Object.keys(b);
  if (aKeys.length !== bKeys.length) return false;
  return aKeys.every((key) => {
    const entryA = a[key];
    const entryB = b[key];
    return (
      entryB !== undefined &&
      entryA.usd === entryB.usd &&
      entryA.symbol === entryB.symbol &&
      entryA.coingeckoId === entryB.coingeckoId
    );
  });
}

async function main() {
  const snapshot = await fetchCurrentPrices();
  const existing = await readExistingSnapshot();

  // Preserve the existing `generatedAt` when the actual price data hasn't changed,
  // so scheduled no-op runs don't produce a spurious git diff.
  const outputSnapshot: PriceSnapshot =
    existing && pricesEqual(existing.prices, snapshot.prices)
      ? existing
      : snapshot;

  await mkdir(path.dirname(OUTPUT_PATH), { recursive: true });
  await writeFile(OUTPUT_PATH, `${JSON.stringify(outputSnapshot, null, 2)}\n`, "utf-8");

  console.log(`Wrote ${Object.keys(outputSnapshot.prices).length} prices to ${OUTPUT_PATH}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
