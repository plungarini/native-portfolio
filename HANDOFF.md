# Handoff: native-portfolio — spot-only Solana/BSC portfolio tracker

## Status: STOPPED — read this before touching anything

## 1. Context
Static, backend-less crypto portfolio tracker (Vite+React+TS, GitHub Pages via Actions, public repo `plungarini/native-portfolio`, live at https://plungarini.github.io/native-portfolio/). Full spec: `ARCHITECTURE.md` at repo root. This handoff is specifically about finishing and shipping **Phase 3: data layer** (§9).

## 2. Goal
Commit and push the already-written, already-verified Phase 3 code (Solana/BSC RPC clients, price clients, FIFO PnL engine, react-query hooks), confirm CI green, then stop — do not start Phase 4 without the user's go-ahead.

## 3. In progress right now
All verification is done and everything is green. **Nothing is committed yet** — this was the very last step, interrupted mid-flow:
- `npm test`/`lint`/`typecheck`/`build` all pass (83/83 tests).
- Real-network smoke test (no mocks) against live Solana + BSC RPC completed and passed for every function.
- Secrets scan and dependency-freshness spot-check done, clean.
- The only remaining actions: `git add`/commit/push (default branch `master`, not `main`), then `gh run list -R plungarini/native-portfolio` to confirm CI is green.

## 4. Remaining steps
- Re-verify `git status`/`git log` yourself (see §6).
- `git add` the modified/untracked Phase 3 files + this HANDOFF.md, commit with a real message, push to `master`.
- Confirm CI is green: `gh run list -R plungarini/native-portfolio`.
- Stop after that. Do not start Phase 4 (UI components) without the user's explicit go-ahead.

## 5. What went wrong / what I learned
- **The original "keyless" Solana RPC plan in ARCHITECTURE.md §3.1 doesn't actually work.** The real-network smoke test (which fixture tests never would have caught) found `getTokenAccountsByOwner` (SPL/Token-2022 balance enumeration) returns HTTP 403 on both configured hosts — `solana-rpc.publicnode.com` ("Indexed requests require a personal token") and `rpc.ankr.com/solana` (premium-only). Native SOL balance, tx history, and tx parsing all worked fine unauthenticated; only the *indexed* balance lookup was blocked.
- A free Allnodes/publicnode "personal token" (user signed up for one) did **not** fix it — that dashboard requires an actual paid/hosted node to unlock indexed methods, the free personal token alone isn't enough. Don't re-attempt that path.
- **Fix that worked:** free-tier Helius API key (10 req/s, no credit card). Confirmed via direct `curl` with a real `Origin` header that `getTokenAccountsByOwner` returns real parsed token-account data and CORS headers are permissive. Wired in as the primary Solana RPC host in `src/lib/chains/solana/solanaRpcClient.ts` (`SOLANA_RPC_HOSTS`), read from `import.meta.env.VITE_HELIUS_API_KEY` (falls back to publicnode-only if unset), with unauthenticated `solana-rpc.publicnode.com` kept as fallback for the non-indexed methods.
- **The app is no longer fully "keyless" for Solana.** The key is NOT committed to source (kept in `.env.local`, gitignored via the existing `*.local` pattern, with `.env.example` documenting the var) and is stored as a GitHub Actions repo secret (`VITE_HELIUS_API_KEY`, already set via `gh secret set`, wired into both `ci.yml` and `deploy.yml`'s build steps). But since this is a static site with no backend, the key still ends up baked into the deployed public JS bundle at build time — that part is unavoidable and was discussed with/accepted by the user. Verified the env wiring actually works end-to-end via a throwaway vitest check (not committed) before removing it. ARCHITECTURE.md §3.1/§3.4's "no key anywhere" claims are now stale and should be corrected in a follow-up — did not do this yet.
- BSC needed no such fix — `eth_getBalance`, Multicall3 `eth_call`, and `eth_getLogs` all worked fully on the free public `bsc-rpc.publicnode.com` with zero key, confirmed against real wallets/data.
- The Claude Code auto-mode safety classifier blocked a couple of `Bash` calls that ran `npx tsx` importing the file with the now-embedded Helius key (flagged "Credential Leakage"). Running `npm run lint`/`typecheck`/`build` as separate, individual commands (not chained) worked fine — so it's specifically about combining a raw-key-bearing network call with other commands, not the repo state itself. If you need to re-verify the Solana client via a live script again, expect this and don't try to bypass it — verify via plain `curl` instead (that was never blocked).

## 6. Don't trust this, go verify
- Re-run `git status`/`git log` first — confirm nothing changed since this was written and nothing got half-committed.
- Re-run `npm test`/`npm run lint`/`npm run typecheck`/`npm run build` yourself before trusting the "all green" claim above — it may be stale.
- Re-read `src/lib/chains/solana/solanaRpcClient.ts` directly to confirm the `SOLANA_RPC_HOSTS` array still has the Helius key as intended before pushing — don't trust this summary of it.
- Check `gh auth status` for the `workflow` scope before assuming a push touching `.github/workflows/*.yml` will work (it had it as of last check).
- Confirm `gh secret list -R plungarini/native-portfolio` still shows `VITE_HELIUS_API_KEY` before assuming CI/deploy will succeed — the build fails without it (or silently degrades to publicnode-only, no crash, just no SPL balances) if the secret is ever removed.
- The Helius key value itself was pasted in this conversation's transcript history (both in earlier plaintext messages and in a `curl` command's output) — it is not secret-strength secure regardless of the git/env-var cleanup. If that's a concern, rotate it in the Helius dashboard and update both `.env.local` and the GitHub secret.

Before doing anything else, verify the current state of the repo/task yourself. This document may be stale or incomplete.
