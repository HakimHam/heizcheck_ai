import type { BillingPeriod, IsoDate } from './figures'

/** Today's date in Germany, `YYYY-MM-DD`: the default Dispatch Date. */
export const todayInGermany = (): IsoDate =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(new Date())

/** `2026-10-02` → `02.10.2026` */
export const formatDate = (date: IsoDate) => date.split('-').reverse().join('.')

export const formatBillingPeriod = (period: BillingPeriod | null) =>
  period ? `${formatDate(period.start)} – ${formatDate(period.end)}` : 'Zeitraum unbekannt'

/** Midnight UTC of a date, so day counts can't be shifted by daylight saving time. */
export const toUtc = (date: IsoDate) => {
  const [year, month, day] = date.split('-').map(Number)
  return Date.UTC(year, month - 1, day)
}

export const daysBetween = (from: IsoDate, to: IsoDate) => Math.round((toUtc(to) - toUtc(from)) / 86_400_000)
