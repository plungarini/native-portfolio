# native-portfolio

A static, backend-less, client-side spot-portfolio tracker for Solana and BSC
wallets. See [ARCHITECTURE.md](./ARCHITECTURE.md) for the full design.

## Stack

Vite + React + TypeScript (strict), Tailwind CSS v4 (CSS-first `@theme`
tokens in `src/styles/tokens.css`), ESLint + typescript-eslint + Prettier,
Vitest + React Testing Library.

## Scripts

```
npm run dev         # start the Vite dev server
npm run build        # typecheck (tsc -b) + production build
npm run preview       # preview the production build locally
npm run lint          # ESLint
npm run typecheck     # tsc -b --noEmit
npm test              # Vitest (single run)
npm run format        # Prettier --write
npm run format:check  # Prettier --check
```

## Deployment

Built as a static site and deployed to GitHub Pages as a project site at
`/native-portfolio/` (see `base` in `vite.config.ts`).
