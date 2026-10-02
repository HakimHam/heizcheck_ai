import { formatBillingPeriod } from '../../dates'
import type { BillingPeriod } from '../../figures'
import type { Rule } from '../types'

const samePeriod = (a: BillingPeriod, b: BillingPeriod) => a.start === b.start && a.end === b.end

/**
 * C3: every Unit Statement has the Building Statement's Billing Period. A Unit
 * that differs is an Error even when another Unit's period is missing.
 */
export const c3: Rule = ({ confirmedFigures: { building, units } }) => {
  if (units.length === 0) {
    return { status: 'not_assessable', reason: 'Das Paket enthält keine Einzelabrechnungen.' }
  }
  const period = building.billingPeriod
  if (period === null) {
    return {
      status: 'not_assessable',
      reason: 'Der Abrechnungszeitraum der Gesamtabrechnung fehlt.',
    }
  }

  const differing = units.filter((unit) => unit.billingPeriod && !samePeriod(unit.billingPeriod, period))
  if (differing.length === 0) {
    const missing = units.filter((unit) => unit.billingPeriod === null).map((unit) => unit.unitId)
    if (missing.length > 0) {
      return {
        status: 'not_assessable',
        reason: `Der Abrechnungszeitraum fehlt für: ${missing.join(', ')}.`,
      }
    }
    return { status: 'passed' }
  }

  return {
    status: 'finding',
    findings: [
      {
        severity: 'error',
        legalReference: '§556 Abs. 3 BGB',
        message:
          `Die Gesamtabrechnung gilt für ${formatBillingPeriod(period)}, ` +
          `${differing.length === 1 ? 'eine Einzelabrechnung gilt' : `${differing.length} Einzelabrechnungen gelten`} ` +
          `für einen anderen Zeitraum: ` +
          differing.map((unit) => `${unit.unitId} (${formatBillingPeriod(unit.billingPeriod)})`).join(', ') +
          '. Das Paket mischt Abrechnungszeiträume.',
        affectedUnits: differing.map((unit) => unit.unitId),
        amountAtStakeCents: null,
      },
    ],
  }
}
