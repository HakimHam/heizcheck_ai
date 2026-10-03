import type { Finding } from '@/lib/check-engine'
import {
  affectedUnitsLabel,
  formatCreatedAt,
  orderForReport,
  RESULT_LABELS,
  RULE_TITLES,
  SEVERITY_LABELS,
  summarise,
  warningsLabel,
} from '@/lib/check-report'
import { formatDate } from '@/lib/dates'
import { formatCents } from '@/lib/money'
import type { CheckReport } from '@/lib/statement-packages'

function FindingView({ finding }: { finding: Finding }) {
  return (
    <li className={`finding finding-${finding.severity}`}>
      <div>
        <strong>{SEVERITY_LABELS[finding.severity]}</strong> · {finding.legalReference}
      </div>
      <p>{finding.message}</p>
      <div className="muted">
        Betroffen: {affectedUnitsLabel(finding)}
        {finding.amountAtStakeCents !== null && <> · Betrag: {formatCents(finding.amountAtStakeCents)}</>}
      </div>
    </li>
  )
}

export function CheckReportView({ report }: { report: CheckReport }) {
  const { errors, warnings, notAssessable } = summarise(report.results)
  return (
    <section className="stack">
      <div className="page-title">
        <h2>Prüfbericht</h2>
        <a className="button secondary" href={`/pakete/${report.statementPackageId}/pruefbericht`} download>
          Als PDF herunterladen
        </a>
      </div>
      <p className="muted">
        Erstellt am {formatCreatedAt(report.createdAt)} · Versanddatum {formatDate(report.dispatchDate)} ·
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
