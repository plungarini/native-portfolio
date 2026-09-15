// Spot PnL hero card, mirroring jup.ag/portfolio's right-hand hero card:
// signed period total, Best day / Streak stats, a per-day dot grid and a
// footer linking out to the full PnL calendar.
import { useMemo } from 'react'
import type { ReactNode } from 'react'
import { CalendarBlank, CaretRight } from '@phosphor-icons/react'
import { Card, CardBody, CardHeader } from '../ui/Card'
import type { PnlCalendarDay } from '../../hooks/usePnlCalendar'
import { formatMainCurrency, formatSignedMainCurrency, formatSignedUsd, formatUsd } from '../../lib/format/currency'
import { FIXED_UNIT_CURRENCIES } from '../../config/currencies'

interface SpotPnlCardProps {
  days: PnlCalendarDay[]
  mainCurrency: string
  periodLabel?: string
  onOpenCalendar?: () => void
  action?: ReactNode
}

const MONTH_LABELS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
]

interface PeriodInfo {
  year: number
  /** 0-indexed. */
  month: number
  /** Last day of the period that actually has data (or today's date). */
  lastDayOfMonth: number
  totalDaysInMonth: number
}

function parseDateKey(date: string): { year: number; month: number; day: number } {
  const [year, month, day] = date.split('-').map(Number)
  return { year, month: month - 1, day }
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
}

/** The dot grid spans the calendar month of the most recent day with data,
 * falling back to the current UTC month when there is none. */
function derivePeriod(days: PnlCalendarDay[]): PeriodInfo {
  const latest = days.reduce<string | null>(
    (acc, day) => (acc === null || day.date > acc ? day.date : acc),
    null,
  )
  const { year, month, day } =
    latest !== null
      ? parseDateKey(latest)
      : (() => {
          const now = new Date()
          return {
            year: now.getUTCFullYear(),
            month: now.getUTCMonth(),
            day: now.getUTCDate(),
          }
        })()

  return { year, month, lastDayOfMonth: day, totalDaysInMonth: daysInMonth(year, month) }
}

/** Streak = consecutive most-recent days (by date) with pnlUsd > 0. */
function computeStreak(sorted: PnlCalendarDay[]): number {
  let streak = 0
  for (let i = sorted.length - 1; i >= 0; i -= 1) {
    if (sorted[i].pnlUsd > 0) streak += 1
    else break
  }
  return streak
}

function dotClasses(day: PnlCalendarDay | undefined, isCurrent: boolean): string {
  if (!day || day.pnlUsd === 0) {
    return isCurrent ? 'bg-muted-foreground/70' : 'bg-muted'
  }
  if (day.pnlUsd > 0) return isCurrent ? 'bg-success' : 'bg-success/60'
  return isCurrent ? 'bg-destructive' : 'bg-destructive/60'
}

export function SpotPnlCard({
  days,
  mainCurrency,
  periodLabel,
  onOpenCalendar,
  action,
}: SpotPnlCardProps) {
  const sorted = useMemo(
    () => [...days].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0)),
    [days],
  )

  const period = useMemo(() => derivePeriod(sorted), [sorted])

  const byDate = useMemo(() => {
    const map = new Map<string, PnlCalendarDay>()
    for (const day of sorted) map.set(day.date, day)
    return map
  }, [sorted])

  const totalUsd = sorted.reduce((sum, day) => sum + day.pnlUsd, 0)
  // A day whose main-currency conversion was unavailable contributes nothing
  // rather than being counted as zero; if none converted, the line is dropped.
  const convertedDays = sorted.filter((day) => day.pnlMainCurrency !== null)
  const totalMainCurrency =
    convertedDays.length === 0
      ? null
      : convertedDays.reduce((sum, day) => sum + (day.pnlMainCurrency ?? 0), 0)

  const bestDay = sorted.reduce<PnlCalendarDay | null>(
    (best, day) => (best === null || day.pnlUsd > best.pnlUsd ? day : best),
    null,
  )
  const streak = computeStreak(sorted)

  const label = periodLabel ?? MONTH_LABELS[period.month]
  const rangeText = `${MONTH_LABELS[period.month]} 1-${period.lastDayOfMonth}`

  const totalTone = totalUsd >= 0 ? 'text-success' : 'text-destructive'
  // Main-currency-first per ARCHITECTURE.md §6, except when the main
  // currency IS USD, where the two are identical and only one should show.
  // Zero reads with an explicit "+" for the headline figure, like Jupiter's
  // own "+$0.00" — formatSignedUsd/formatSignedMainCurrency only add "+"
  // for a strictly-positive value, so force it here for whichever value is
  // the big one.
  const isFixedUnitCurrency = FIXED_UNIT_CURRENCIES.has(mainCurrency.toUpperCase())
  const bigTotalText =
    isFixedUnitCurrency || totalMainCurrency === null
      ? `${totalUsd < 0 ? '' : '+'}${formatUsd(totalUsd)}`
      : `${totalMainCurrency < 0 ? '' : '+'}${formatMainCurrency(totalMainCurrency, mainCurrency)}`

  const gridDays = Array.from({ length: period.totalDaysInMonth }, (_, i) => i + 1)

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium text-foreground">Spot PnL</span>
          <span className="text-sm text-muted-foreground">{label}</span>
        </div>
        {action ? <div className="flex items-center">{action}</div> : null}
      </CardHeader>

      <CardBody className="gap-4">
        <div className="flex flex-col gap-0.5">
          <span className={`text-3xl font-semibold ${totalTone}`}>{bigTotalText}</span>
          {!isFixedUnitCurrency && totalMainCurrency !== null && (
            <span className="text-xs text-muted-foreground">{formatSignedUsd(totalUsd)}</span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex flex-col gap-0.5">
            <span className="w-fit text-xs text-muted-foreground underline decoration-foreground-faint/80 decoration-dotted underline-offset-4">
              Best day
            </span>
            <span className="text-sm font-medium text-foreground">
              {bestDay
                ? isFixedUnitCurrency || bestDay.pnlMainCurrency === null
                  ? formatSignedUsd(bestDay.pnlUsd)
                  : formatSignedMainCurrency(bestDay.pnlMainCurrency, mainCurrency)
                : '—'}
            </span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="w-fit text-xs text-muted-foreground underline decoration-foreground-faint/80 decoration-dotted underline-offset-4">
              Streak
            </span>
            <span className="text-sm font-medium text-foreground">
              {streak} {streak === 1 ? 'day' : 'days'}
            </span>
          </div>
        </div>

        <ul className="flex flex-wrap items-center gap-1" aria-label="Daily PnL">
          {gridDays.map((dayNumber) => {
            const date = `${period.year}-${String(period.month + 1).padStart(2, '0')}-${String(dayNumber).padStart(2, '0')}`
            const day = byDate.get(date)
            const isCurrent = dayNumber === period.lastDayOfMonth
            return (
              <li
                key={date}
                data-testid={`pnl-dot-${date}`}
                title={`${date}: ${day ? formatSignedUsd(day.pnlUsd) : 'no activity'}`}
                className={`size-1.5 rounded-[2px] ${dotClasses(day, isCurrent)}`}
              />
            )
          })}
        </ul>

        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <CalendarBlank className="size-3.5" aria-hidden="true" />
            {rangeText}
          </span>
          <button
            type="button"
            onClick={onOpenCalendar}
            className="flex cursor-pointer items-center gap-1 text-xs font-medium text-muted-foreground transition hover:text-foreground"
          >
            PnL Calendar
            <CaretRight className="size-3" weight="bold" aria-hidden="true" />
          </button>
        </div>
      </CardBody>
    </Card>
  )
}
