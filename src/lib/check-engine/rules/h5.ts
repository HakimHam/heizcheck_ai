import type { Rule } from '../types'
import { missingEstimatedFlags, NO_UNIT_STATEMENTS, withEstimatedReadings } from './estimated-readings'

/** H5: any estimated readings are worth checking, so each one is listed. Needs every Unit's flag. */
export const h5: Rule = ({ confirmedFigures: { units } }) => {
  if (units.length === 0) return NO_UNIT_STATEMENTS
  const missingFlags = missingEstimatedFlags(units)
  if (missingFlags) return missingFlags
  const estimated = withEstimatedReadings(units)
  if (estimated.length === 0) return { status: 'passed' }

  const ids = estimated.map((unit) => unit.unitId)
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
