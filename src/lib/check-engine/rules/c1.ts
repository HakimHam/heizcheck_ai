import { formatCents } from '../../money'
import type { Rule } from '../types'

/** Rounding allowance per Unit Statement. */
const TOLERANCE_CENTS_PER_UNIT = 5

/** C1: the Unit amounts add up to the building total within €0.05 per Unit. */
export const c1: Rule = ({ confirmedFigures: { building, units } }) => {
  if (units.length === 0) {
    return { status: 'not_assessable', reason: 'Das Paket enthält keine Einzelabrechnungen.' }
  }
  if (building.totalCostCents === null) {
    return {
      status: 'not_assessable',
      reason: 'Die Gesamtkosten der Gesamtabrechnung fehlen.',
    }
  }
  const missing = units.filter((unit) => unit.amountCents === null).map((unit) => unit.unitId)
  if (missing.length > 0) {
    return {
      status: 'not_assessable',
      reason: `Der Betrag fehlt für: ${missing.join(', ')}.`,
    }
  }

  const unitSum = units.reduce((sum, unit) => sum + (unit.amountCents ?? 0), 0)
  const difference = Math.abs(unitSum - building.totalCostCents)
  if (difference <= TOLERANCE_CENTS_PER_UNIT * units.length) return { status: 'passed' }

  return {
    status: 'finding',
    findings: [
      {
        severity: 'error',
        legalReference: '§6 Abs. 1 HeizkostenV',
        message:
          `Die Beträge der Einzelabrechnungen ergeben zusammen ${formatCents(unitSum)}, ` +
          `die Gesamtabrechnung weist ${formatCents(building.totalCostCents)} aus. ` +
          `Die Abweichung von ${formatCents(difference)} übersteigt die Rundungstoleranz ` +
          `von ${formatCents(TOLERANCE_CENTS_PER_UNIT)} je Nutzeinheit.`,
        affectedUnits: units.map((unit) => unit.unitId),
        amountAtStakeCents: difference,
      },
    ],
  }
}
