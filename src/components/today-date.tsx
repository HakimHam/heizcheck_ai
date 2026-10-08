import { formatTodayInGermany } from '@/lib/dates'

/** Today's date on the dashboard, e.g. `Heute: 07.10.2026`. */
export function TodayDate() {
  return <span className="muted">Heute: {formatTodayInGermany()}</span>
}
