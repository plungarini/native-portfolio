import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient } from '@tanstack/react-query'
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client'
import { createSyncStoragePersister } from '@tanstack/query-sync-storage-persister'
import './index.css'
import App from './App.tsx'

// Data-fetching/caching per ARCHITECTURE.md §1: react-query for request
// de-dupe + retry/backoff, with its cache mirrored into localStorage via
// `@tanstack/query-sync-storage-persister` so the last-known-good data for
// every hook survives a reload and can be served as the "stale" fallback
// per §2's fallback-path description if a live API call then fails.
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      staleTime: 60_000,
      gcTime: 24 * 60 * 60 * 1000,
    },
  },
})

const persister = createSyncStoragePersister({
  key: 'portfolio.reactQueryCache',
  storage: typeof window !== 'undefined' ? window.localStorage : undefined,
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister, maxAge: 24 * 60 * 60 * 1000 }}
    >
      <App />
    </PersistQueryClientProvider>
  </StrictMode>,
)
