import type { CostItem } from '../../figures'
import { formatCents } from '../../money'
import type { Finding, Rule, Severity } from '../types'
import { lookUpCostItem, NOT_ELIGIBLE } from './cost-types'

/** A Cost Item's Finding names the item exactly as written and puts its amount at stake. */
const costItemFinding = (severity: Severity, item: CostItem, verdict: string): Finding => ({
  severity,
  legalReference: '§7 Abs. 2 HeizkostenV',
  message:
    `Die Kostenposition „${item.name}“` +
    (item.amountCents === null ? '' : ` über ${formatCents(item.amountCents)}`) +
    ` ${verdict}`,
  affectedUnits: [],
  amountAtStakeCents: item.amountCents,
})

/**
 * H3: every Cost Item maps to an Eligible Cost Type. An item mapped to "not
 * eligible" is an Error; an item missing from the mapping table is a Warning.
 */
export const h3: Rule = ({ confirmedFigures: { building } }) => {
  if (building.costItems.length === 0) {
    return { status: 'not_assessable', reason: 'Die Gesamtabrechnung weist keine Kostenpositionen aus.' }
  }
  const errors: Finding[] = []
  const warnings: Finding[] = []
  for (const item of building.costItems) {
    const type = lookUpCostItem(item.name)
    if (type === NOT_ELIGIBLE) {
      errors.push(
        costItemFinding('error', item, 'ist nicht umlagefähig und darf den Mietern nicht als Heizkosten berechnet werden.'),
      )
    } else if (type === undefined) {
      warnings.push(
        costItemFinding(
          'warning',
          item,
          'ist keiner umlagefähigen Kostenart zugeordnet. Bitte prüfen Sie, ob sie den Mietern berechnet werden darf.',
        ),
      )
    }
  }
  const findings = [...errors, ...warnings]
  if (findings.length === 0) return { status: 'passed' }
  return { status: 'finding', findings }
}
