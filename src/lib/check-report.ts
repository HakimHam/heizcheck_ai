import type { CheckResult, Finding, RuleId } from './check-engine'

/** What each rule checks, in German, for the Check Report. */
export const RULE_TITLES: Record<RuleId, string> = {
  C1: 'Summe der Einzelabrechnungen',
  C2: 'Summe der Flächen',
  C3: 'Einheitlicher Abrechnungszeitraum',
  H1: 'Verbrauchsanteil Heizung',
  H2: 'Verbrauchsanteil Warmwasser',
  H3: 'Umlagefähige Kostenarten',
  H4: 'Verteilung bei geschätzten Werten',
  H5: 'Geschätzte Verbrauchswerte',
  K1: 'Aufteilung der CO₂-Kosten',
  K2: 'CO₂-Angaben',
  B1: 'Abrechnungsfrist',
}

const hasSeverity = (result: CheckResult, severity: Finding['severity']) =>
  result.status === 'finding' && result.findings.some((f) => f.severity === severity)

// Lower ranks first: definite problems, then judgement calls, then what
// couldn't be checked, then what passed.
const rank = (result: CheckResult) =>
  hasSeverity(result, 'error')
    ? 0
    : result.status === 'finding'
      ? 1
      : result.status === 'not_assessable'
        ? 2
        : 3

const errorsFirst = (findings: Finding[]) =>
  [...findings].sort((a, b) => Number(a.severity === 'warning') - Number(b.severity === 'warning'))

/** The Check Results as the Check Report lists them. Stable, so ties keep catalogue order. */
export function orderForReport(results: CheckResult[]): CheckResult[] {
  return [...results]
    .sort((a, b) => rank(a) - rank(b))
    .map((result) =>
      result.status === 'finding' ? { ...result, findings: errorsFirst(result.findings) } : result,
    )
}

export const warningsLabel = (count: number) => (count === 1 ? 'Prüfhinweis' : 'Prüfhinweise')

export type ReportSummary = { errors: number; warnings: number; notAssessable: number }

export function summarise(results: CheckResult[]): ReportSummary {
  const findings = results.flatMap((r) => (r.status === 'finding' ? r.findings : []))
  return {
    errors: findings.filter((f) => f.severity === 'error').length,
    warnings: findings.filter((f) => f.severity === 'warning').length,
    notAssessable: results.filter((r) => r.status === 'not_assessable').length,
  }
}
