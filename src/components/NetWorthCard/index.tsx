import { useId } from 'react'
import { WalletIcon } from '@phosphor-icons/react'
import { Card, CardBody, CardHeader } from '../ui/Card'
import { formatMainCurrency, formatSignedUsd, formatUsd, PRICE_UNAVAILABLE } from '../../lib/format/currency'
import { FIXED_UNIT_CURRENCIES } from '../../config/currencies'

interface NetWorthCardProps {
  totalUsd: number | null
  mainCurrencyTotal: number | null
  mainCurrency: string
  changeUsd: number | null
  changePercent: number | null
  series?: number[]
  ranges?: string[]
  activeRange?: string
  onRangeChange?: (range: string) => void
}

const SPARK_WIDTH = 100
const SPARK_HEIGHT = 40

function formatSignedPercent(value: number): string {
  const sign = value > 0 ? '+' : ''
  return `${sign}${value.toFixed(2)}%`
}

interface SparklineGeometry {
  line: string
  area: string
  rising: boolean
}

function buildSparkline(series: number[]): SparklineGeometry | null {
  const points = series.filter((value) => Number.isFinite(value))
  if (points.length < 2) return null

  const min = Math.min(...points)
  const max = Math.max(...points)
  // A perfectly flat series would divide by zero; draw it down the middle instead.
  const span = max - min
  const stepX = SPARK_WIDTH / (points.length - 1)

  const coords = points.map((value, index) => {
    const x = index * stepX
    const y = span === 0 ? SPARK_HEIGHT / 2 : SPARK_HEIGHT - ((value - min) / span) * SPARK_HEIGHT
    return `${x.toFixed(2)},${y.toFixed(2)}`
  })

  const line = `M${coords.join('L')}`
  const area = `${line}L${SPARK_WIDTH},${SPARK_HEIGHT}L0,${SPARK_HEIGHT}Z`

  return { line, area, rising: points[points.length - 1] >= points[0] }
}

export function NetWorthCard({
  totalUsd,
  mainCurrencyTotal,
  mainCurrency,
  changeUsd,
  changePercent,
  series = [],
  ranges = [],
  activeRange,
  onRangeChange,
}: NetWorthCardProps) {
  const gradientId = useId()
  const spark = buildSparkline(series)

  const changeBasis = changeUsd ?? changePercent
  const hasChange = changeBasis !== null
  const changePositive = (changeBasis ?? 0) >= 0
  const changeToneClass = changePositive ? 'text-success' : 'text-destructive'
  const trendToneClass = spark?.rising ? 'text-success' : 'text-destructive'

  // Main-currency-first per ARCHITECTURE.md §6: the selected main currency
  // leads (big), USD trails (small) — except when the main currency IS USD,
  // where the two are identical and only one figure should show.
  const isFixedUnitCurrency = FIXED_UNIT_CURRENCIES.has(mainCurrency.toUpperCase())
  const bigValue = isFixedUnitCurrency ? totalUsd : mainCurrencyTotal
  const bigText = isFixedUnitCurrency
    ? formatUsd(bigValue)
    : formatMainCurrency(bigValue, mainCurrency)

  return (
    <Card>
      <CardHeader>
        <div className="flex h-9 items-center gap-1 rounded-full border border-border/35 bg-border/30 p-0.5">
          <span className="flex items-center gap-1.5 rounded-full bg-accent/15 px-2.5 py-1 text-sm font-medium text-accent">
            <WalletIcon size={14} weight="fill" aria-hidden="true" />
            Net worth
          </span>
        </div>

        {ranges.length > 0 && (
          <div className="flex items-center gap-0.5 rounded-full bg-border/30 p-0.5" role="group" aria-label="Range">
            {ranges.map((range) => {
              const active = range === activeRange
              return (
                <button
                  key={range}
                  type="button"
                  aria-pressed={active}
                  onClick={() => onRangeChange?.(range)}
                  className={[
                    'cursor-pointer rounded-full px-2.5 py-1 text-xs font-medium transition-colors',
                    active
                      ? 'bg-input text-foreground'
                      : 'text-muted-foreground hover:text-foreground-secondary',
                  ].join(' ')}
                >
                  {range}
                </button>
              )
            })}
          </div>
        )}
      </CardHeader>

      <CardBody className="gap-1 pb-0">
        <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
          <span
            className={
              bigValue === null
                ? 'text-2xl font-semibold tracking-tight text-muted-foreground'
                : 'text-4xl font-semibold tracking-tight text-foreground'
            }
          >
            {bigText}
          </span>
          {!isFixedUnitCurrency && (
            <span className="text-sm text-muted-foreground">{formatUsd(totalUsd)}</span>
          )}
        </div>

        {hasChange ? (
          <p className="text-sm font-medium">
            <span className={changeToneClass}>
              {changeUsd === null ? PRICE_UNAVAILABLE : formatSignedUsd(changeUsd)}
              {changePercent !== null && ` (${formatSignedPercent(changePercent)})`}
            </span>
            <span className="text-muted-foreground"> since yesterday</span>
          </p>
        ) : (
          <p className="text-sm font-light text-muted-foreground">No change data</p>
        )}
      </CardBody>

      {spark ? (
        <svg
          data-testid="networth-sparkline"
          className={`h-28 w-full ${trendToneClass}`}
          viewBox={`0 0 ${SPARK_WIDTH} ${SPARK_HEIGHT}`}
          preserveAspectRatio="none"
          role="presentation"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="currentColor" stopOpacity="0.28" />
              <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={spark.area} fill={`url(#${gradientId})`} stroke="none" />
          <path
            d={spark.line}
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      ) : (
        <div
          data-testid="networth-sparkline-empty"
          className="min-h-0 w-full flex-1"
          aria-hidden="true"
        />
      )}
    </Card>
  )
}
