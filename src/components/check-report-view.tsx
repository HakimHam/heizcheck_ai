import type { CheckResult, Finding } from '@/lib/check-engine'
import { orderForReport, RULE_TITLES, summarise, warningsLabel } from '@/lib/check-report'
import { formatDate } from '@/lib/dates'
import { formatCents } from '@/lib/money'
import type { CheckReport } from '@/lib/statement-packages'

const SEVERITY_LABELS: Record<Finding['severity'], string> = {
  error: 'Fehler',
  warning: 'Prüfhinweis',
}

const RESULT_LABELS: Record<CheckResult['status'], string> = {
  passed: 'Bestanden',
  finding: 'Befund',
  not_assessable: 'Nicht prüfbar',
}

const createdAt = (timestamp: string) =>
  new Intl.DateTimeFormat('de-DE', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Europe/Berlin',
  }).format(new Date(timestamp))

function FindingView({ finding }: { finding: Finding }) {
  return (
    <li className={`finding finding-${finding.severity}`}>
      <div>
        <strong>{SEVERITY_LABELS[finding.severity]}</strong> · {finding.legalReference}
      </div>
      <p>{finding.message}</p>
      <div className="muted">
        Betroffen: {finding.affectedUnits.length > 0 ? finding.affectedUnits.join(', ') : 'ganzes Gebäude'}
        {finding.amountAtStakeCents !== null && <> · Betrag: {formatCents(finding.amountAtStakeCents)}</>}
      </div>
    </li>
  )
}

export function CheckReportView({ report }: { report: CheckReport }) {
  const { errors, warnings, notAssessable } = summarise(report.results)
  return (
    <section className="stack">
      <h2>Prüfbericht</h2>
      <p className="muted">
        Erstellt am {createdAt(report.createdAt)} · Versanddatum {formatDate(report.dispatchDate)} ·
        Regelwerk {report.rulesetVersion}
      </p>
      <p>
        <strong>{errors}</strong> Fehler, <strong>{warnings}</strong>{' '}
        {warningsLabel(warnings)}, <strong>{notAssessable}</strong> nicht prüfbar
      </p>
      <ol className="results">
        {orderForReport(report.results).map((result) => (
          <li key={result.rule} className={`result result-${result.status}`}>
            <div className="result-head">
              <span>
                <strong>{result.rule}</strong> {RULE_TITLES[result.rule]}
              </span>
              <span className={`badge badge-${result.status}`}>{RESULT_LABELS[result.status]}</span>
            </div>
            {result.status === 'not_assessable' && <p className="muted">{result.reason}</p>}
            {result.status === 'finding' && (
              <ul className="findings">
                {result.findings.map((finding, i) => (
                  <FindingView key={i} finding={finding} />
                ))}
              </ul>
            )}
          </li>
        ))}
      </ol>
    </section>
  )
}
