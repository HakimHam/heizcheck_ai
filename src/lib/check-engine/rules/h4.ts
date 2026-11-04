import type { Rule } from '../types'
import { missingAreas, sumAreaMilli } from './areas'
import { formatShare } from './consumption-share'
import { missingEstimatedFlags, NO_UNIT_STATEMENTS, withEstimatedReadings } from './estimated-readings'

/** §9a para 2 HeizkostenV: above this share of estimated area, split by area only. */
const MAX_ESTIMATED_SHARE_PCT = 25

/**
 * H4: if readings were estimated for more than 25% of the area (the area of
 * Units with estimated readings ÷ the total Unit area), the costs must be split
 * by area only. Units known to be estimated can prove the Error even when
 * another Unit's flag is missing; they can't prove a pass.
 */
export const h4: Rule = ({ confirmedFigures: { building, units } }) => {
  if (units.length === 0) return NO_UNIT_STATEMENTS
  if (building.allocationMethod === null) {
    return { status: 'not_assessable', reason: 'Die Verteilung (nach Verbrauch oder nur nach Fläche) fehlt.' }
  }
  if (building.allocationMethod === 'area_only') return { status: 'passed' }

  const estimated = withEstimatedReadings(units)
  const missingFlags = missingEstimatedFlags(units)
  if (estimated.length === 0) return missingFlags ?? { status: 'passed' }

  const missing = missingAreas(units)
  if (missing) return missing
  const estimatedMilli = sumAreaMilli(estimated)
  const totalMilli = sumAreaMilli(units)
  if (estimatedMilli * 100 <= totalMilli * MAX_ESTIMATED_SHARE_PCT) return missingFlags ?? { status: 'passed' }

  return {
    status: 'finding',
    findings: [
      {
        severity: 'error',
        legalReference: '§9a Abs. 2 HeizkostenV',
        message:
          `Die Ablesewerte sind für ${missingFlags ? 'mindestens ' : ''}` +
          `${formatShare((estimatedMilli / totalMilli) * 100)} der Fläche geschätzt. ` +
          `Bei mehr als ${formatShare(MAX_ESTIMATED_SHARE_PCT)} müssen die Kosten allein nach Fläche verteilt werden, ` +
          `die Abrechnung verteilt sie aber nach Verbrauch.`,
        affectedUnits: estimated.map((unit) => unit.unitId),
        amountAtStakeCents: null,
      },
    ],
  }
}
