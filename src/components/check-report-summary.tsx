import type { CheckResult } from '@/lib/check-engine'
import { summarise, warningsLabel } from '@/lib/check-report'

/** A Check Report in a few words, e.g. "2 Fehler, 1 Prüfhinweis". */
export function CheckReportSummary({ results }: { results: CheckResult[] | null }) {
  if (!results) return <span className="muted">Noch keiner</span>
  const { errors, warnings, notAssessable } = summarise(results)
  const parts = [
    errors > 0 && `${errors} Fehler`,
    warnings > 0 && `${warnings} ${warningsLabel(warnings)}`,
  ].filter(Boolean)
  return (
    <span className={errors > 0 ? 'error' : undefined}>
      {parts.length > 0 ? parts.join(', ') : 'Ohne Befund'}
      {notAssessable > 0 && <span className="muted"> · {notAssessable} nicht prüfbar</span>}
    </span>
  )
}
