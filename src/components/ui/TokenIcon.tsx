// Round token logo with a deterministic colored-initial fallback for tokens
// Jupiter has no icon for (or when the image fails to load).
import { useState } from 'react'

const FALLBACK_COLORS = ['#c7f284', '#35d399', '#7dd3fc', '#fbbf24', '#fb7185', '#a78bfa', '#f472b6', '#67e8f9']

function colorFor(seed: string): string {
  let hash = 0
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0
  return FALLBACK_COLORS[hash % FALLBACK_COLORS.length]
}

interface TokenIconProps {
  symbol: string
  iconUrl?: string | null
  /** Pixel size; Jupiter uses 28px in the holdings table. */
  size?: number
}

export function TokenIcon({ symbol, iconUrl, size = 28 }: TokenIconProps) {
  const [failed, setFailed] = useState(false)
  const dimension = { width: size, height: size }

  if (iconUrl && !failed) {
    return (
      <img
        src={iconUrl}
        alt=""
        aria-hidden="true"
        loading="lazy"
        onError={() => setFailed(true)}
        style={dimension}
        className="shrink-0 rounded-full bg-muted object-cover"
      />
    )
  }

  return (
    <span
      aria-hidden="true"
      style={{ ...dimension, backgroundColor: colorFor(symbol), fontSize: size * 0.4 }}
      className="flex shrink-0 items-center justify-center rounded-full font-semibold text-background"
    >
      {symbol.slice(0, 2).toUpperCase()}
    </span>
  )
}
