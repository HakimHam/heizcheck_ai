import type { BillingPeriod, IsoDate } from './figures'

/** Today's date in Germany, `YYYY-MM-DD`: the default Dispatch Date. */
export const todayInGermany = (): IsoDate =>
  new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Berlin' }).format(new Date())

/** `2026-10-02` → `02.10.2026` */
export const formatDate = (date: IsoDate) => date.split('-').reverse().join('.')

export const formatBillingPeriod = (period: BillingPeriod | null) =>
  period ? `${formatDate(period.start)} – ${formatDate(period.end)}` : 'Zeitraum unbekannt'
