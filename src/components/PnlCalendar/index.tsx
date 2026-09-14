// PnL calendar heatmap modal, per ARCHITECTURE.md §6. Static fixture data
// only in this phase (Phase 4, per §9) — real wiring to usePnlCalendar is
// Phase 5.
import { useMemo, useState } from 'react'
import { CalendarBlank, CaretLeft, CaretRight } from '@phosphor-icons/react'
import { Modal } from '../ui/Modal'
import type { PnlCalendarDay } from '../../hooks/usePnlCalendar'
import { formatSignedUsd, formatUsd, formatSignedMainCurrency } from '../../lib/format/currency'

interface PnlCalendarProps {
  days: PnlCalendarDay[]
  mainCurrency: string
}

const WEEKDAY_LABELS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

function monthKey(year: number, month: number): string {
  return `${year}-${String(month + 1).padStart(2, '0')}`
}

function parseDateKey(date: string): { year: number; month: number; day: number } {
  const [year, month, day] = date.split('-').map(Number)
  return { year, month: month - 1, day }
}

/** Mon-first leading blank cells before the 1st of `month`. */
function leadingBlankCount(year: number, month: number): number {
  const jsDay = new Date(Date.UTC(year, month, 1)).getUTCDay()
  return (jsDay + 6) % 7
}

function daysInMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month + 1, 0)).getUTCDate()
}

/** §6: none/$0 -> transparent; <$10 -> /5; $10-100 -> /10; >=$100 -> /15.
 * Class names spelled out in full (not interpolated) so Tailwind's
 * source scanner can find them. */
const SUCCESS_TIERS = ['bg-success/5 hover:bg-success/10', 'bg-success/10 hover:bg-success/15', 'bg-success/15 hover:bg-success/20']
const DESTRUCTIVE_TIERS = ['bg-destructive/5 hover:bg-destructive/10', 'bg-destructive/10 hover:bg-destructive/15', 'bg-destructive/15 hover:bg-destructive/20']

function heatmapClasses(pnlUsd: number): string {
  const magnitude = Math.abs(pnlUsd)
  if (magnitude === 0) return 'bg-transparent'
  const tiers = pnlUsd < 0 ? DESTRUCTIVE_TIERS : SUCCESS_TIERS
  const tier = magnitude < 10 ? 0 : magnitude < 100 ? 1 : 2
  return tiers[tier]
}

export function PnlCalendar({ days, mainCurrency }: PnlCalendarProps) {
  const [open, setOpen] = useState(false)

  const byDate = useMemo(() => {
    const map = new Map<string, PnlCalendarDay>()
    for (const day of days) map.set(day.date, day)
    return map
  }, [days])

  const latestDate = useMemo(() => {
    if (days.length === 0) return new Date()
    const latest = days.reduce((a, b) => (a.date > b.date ? a : b))
    const { year, month, day } = parseDateKey(latest.date)
    return new Date(Date.UTC(year, month, day))
  }, [days])

  const [viewYear, setViewYear] = useState(() => latestDate.getUTCFullYear())
  const [viewMonth, setViewMonth] = useState(() => latestDate.getUTCMonth())

  const monthLabel = new Date(Date.UTC(viewYear, viewMonth, 1)).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })

  const cells = useMemo(() => {
    const blanks = leadingBlankCount(viewYear, viewMonth)
    const total = daysInMonth(viewYear, viewMonth)
    const result: ({ day: number; data: PnlCalendarDay | null } | null)[] = Array.from(
      { length: blanks },
      () => null,
    )
    for (let d = 1; d <= total; d++) {
      const key = `${monthKey(viewYear, viewMonth)}-${String(d).padStart(2, '0')}`
      const day = byDate.get(key)
      result.push({ day: d, data: day && day.avgUsdPrice !== null ? day : null })
    }
    return result
  }, [viewYear, viewMonth, byDate])

  const summary = useMemo(() => {
    const data = cells.map((c) => c?.data ?? null).filter((d): d is PnlCalendarDay => d !== null)
    const profitDays = data.filter((d) => d.pnlUsd > 0)
    const lossDays = data.filter((d) => d.pnlUsd < 0)
    const profitValue = profitDays.reduce((sum, d) => sum + d.pnlUsd, 0)
    const lossValue = lossDays.reduce((sum, d) => sum + d.pnlUsd, 0)
    const total = profitDays.length + lossDays.length
    return {
      profitCount: profitDays.length,
      lossCount: lossDays.length,
      profitValue,
      lossValue,
      profitPct: total === 0 ? 0 : (profitDays.length / total) * 100,
      lossPct: total === 0 ? 0 : (lossDays.length / total) * 100,
    }
  }, [cells])

  const goToPrevMonth = () => {
    if (viewMonth === 0) {
      setViewYear((y) => y - 1)
      setViewMonth(11)
    } else {
      setViewMonth((m) => m - 1)
    }
  }

  const goToNextMonth = () => {
    if (viewMonth === 11) {
      setViewYear((y) => y + 1)
      setViewMonth(0)
    } else {
      setViewMonth((m) => m + 1)
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-border bg-input px-3 py-1.5 text-sm text-foreground-secondary hover:text-foreground"
      >
        <CalendarBlank weight="bold" size={16} />
        Calendar
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="PnL Calendar">
        <div className="mb-4 flex items-center justify-between">
          <button type="button" onClick={goToPrevMonth} aria-label="Previous month" className="text-muted-foreground hover:text-foreground">
            <CaretLeft weight="bold" size={18} />
          </button>
          <button type="button" className="text-sm font-medium text-foreground">
            {monthLabel}
          </button>
          <button type="button" onClick={goToNextMonth} aria-label="Next month" className="text-muted-foreground hover:text-foreground">
            <CaretRight weight="bold" size={18} />
          </button>
        </div>

        <div className="mb-4 space-y-1.5">
          <div className="flex h-1.5 overflow-hidden rounded-full bg-muted">
            <div className="h-full bg-success" style={{ width: `${summary.profitPct}%` }} />
            <div className="h-full bg-destructive" style={{ width: `${summary.lossPct}%` }} />
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>
              Profit days {summary.profitCount} / {formatSignedUsd(summary.profitValue)}
            </span>
            <span>
              Loss days {summary.lossCount} / {formatSignedUsd(summary.lossValue)}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-1 text-center text-xs text-foreground-faint">
          {WEEKDAY_LABELS.map((label) => (
            <div key={label} className="pb-1">
              {label}
            </div>
          ))}
          {cells.map((cell, i) => {
            if (cell === null) {
              return <div key={i} className="aspect-square rounded-md bg-transparent" />
            }
            const { day, data } = cell
            const pnlUsd = data?.pnlUsd ?? 0
            return (
              <div
                key={day}
                className={`relative aspect-square rounded-md p-1 ${heatmapClasses(pnlUsd)}`}
              >
                <span className="absolute left-1 top-1 text-[10px] text-foreground/50">{day}</span>
                <div className="flex h-full flex-col items-center justify-center">
                  <span
                    className={`text-sm font-medium ${pnlUsd > 0 ? 'text-success' : pnlUsd < 0 ? 'text-destructive' : 'text-foreground'}`}
                  >
                    {data ? formatSignedMainCurrency(data.pnlMainCurrency, mainCurrency) : formatSignedMainCurrency(0, mainCurrency)}
                  </span>
                  <span className="text-[10px] text-foreground-faint">
                    {data ? formatUsd(data.avgUsdPrice) : formatUsd(0)}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </Modal>
    </>
  )
}
