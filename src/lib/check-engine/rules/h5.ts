import type { Rule } from '../types'
import { estimatedUnits } from './estimated-readings'

/** H5: any estimated readings are worth checking, so each one is listed. */
export const h5: Rule = ({ confirmedFigures: { building, units } }) => {
  const readings = estimatedUnits(units, building.allocationMethod)
  if (readings.status === 'not_assessable') return readings
  if (readings.estimated.length === 0) return { status: 'passed' }

  const ids = readings.estimated.map((unit) => unit.unitId)
  return {
    status: 'finding',
    findings: [
      {
        severity: 'warning',
        legalReference: '§9a Abs. 1 HeizkostenV',
        message:
          `Die Ablesewerte sind geschätzt für: ${ids.join(', ')}. ` +
          `Bitte prüfen, ob die Schätzung zulässig ist und nach §9a Abs. 1 HeizkostenV ermittelt wurde.`,
        affectedUnits: ids,
        amountAtStakeCents: null,
      },
    ],
  }
}
