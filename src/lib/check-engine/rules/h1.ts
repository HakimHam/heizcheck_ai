import type { Finding, Rule } from '../types'
import { buildingFinding, formatShare, isWithinRange, outOfRangeError } from './consumption-share'

/** §7 para 1 sentence 2 HeizkostenV: the share some oil and gas buildings must use. */
const MANDATORY_SHARE_PCT = 70

/**
 * H1: the heating consumption share is 50–70%, or exactly 70% where the
 * Building Profile says §7 para 1 sentence 2 applies. With the flag unset, it
 * also warns that 70% may be required, unless the share is 70% already.
 */
export const h1: Rule = ({ confirmedFigures: { building }, buildingProfile: { mandatory70Pct } }) => {
  const share = building.heatingConsumptionSharePct
  if (share === null) {
    return { status: 'not_assessable', reason: 'Der Verbrauchsanteil Heizung fehlt.' }
  }

  const findings: Finding[] = []
  const outOfRange = () => {
    if (!isWithinRange(share)) findings.push(outOfRangeError('§7 Abs. 1 HeizkostenV', 'Heizkosten', share))
  }
  switch (mandatory70Pct) {
    case true:
      if (share !== MANDATORY_SHARE_PCT) {
        findings.push(
          buildingFinding(
            'error',
            '§7 Abs. 1 Satz 2 HeizkostenV',
            `Die Heizkosten werden zu ${formatShare(share)} nach Verbrauch verteilt. ` +
              `Laut Gebäudeprofil gilt §7 Abs. 1 Satz 2 HeizkostenV: Der Verbrauchsanteil ` +
              `muss genau ${formatShare(MANDATORY_SHARE_PCT)} betragen.`,
          ),
        )
      }
      break
    case false:
      outOfRange()
      break
    case null:
      outOfRange()
      if (share !== MANDATORY_SHARE_PCT) {
        findings.push(
          buildingFinding(
            'warning',
            '§7 Abs. 1 Satz 2 HeizkostenV',
            `Der Verbrauchsanteil muss genau ${formatShare(MANDATORY_SHARE_PCT)} betragen, wenn das Gebäude ` +
              `die Anforderungen der Wärmeschutzverordnung vom 16. August 1994 nicht erfüllt, mit einer ` +
              `Öl- oder Gasheizung versorgt wird und die freiliegenden Leitungen der Wärmeverteilung ` +
              `überwiegend gedämmt sind. Bitte im Gebäudeprofil angeben, ob das für dieses Gebäude gilt.`,
          ),
        )
      }
      break
  }

  return findings.length === 0 ? { status: 'passed' } : { status: 'finding', findings }
}
