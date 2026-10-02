import type { Rule } from '../types'
import { missingAreas, sumAreaMilli } from './areas'
import { formatShare } from './consumption-share'
import { estimatedUnits } from './estimated-readings'

/** §9a para 2 HeizkostenV: above this share of estimated area, split by area only. */
const MAX_ESTIMATED_SHARE_PCT = 25

/**
 * H4: if readings were estimated for more than 25% of the area (the area of
 * Units with estimated readings ÷ the total Unit area), the costs must be split
 * by area only.
 */
export const h4: Rule = ({ confirmedFigures: { building, units } }) => {
  const readings = estimatedUnits(units, building.allocationMethod)
  if (readings.status === 'not_assessable') return readings
  if (readings.estimated.length === 0 || building.allocationMethod === 'area_only') return { status: 'passed' }

  const missing = missingAreas(units)
  if (missing) return missing
  const estimatedMilli = sumAreaMilli(readings.estimated)
  const totalMilli = sumAreaMilli(units)
  if (estimatedMilli * 100 <= totalMilli * MAX_ESTIMATED_SHARE_PCT) return { status: 'passed' }

  return {
    status: 'finding',
    findings: [
      {
        severity: 'error',
        legalReference: '§9a Abs. 2 HeizkostenV',
        message:
          `Die Ablesewerte sind für ${formatShare((estimatedMilli / totalMilli) * 100)} der Fläche geschätzt. ` +
          `Bei mehr als ${formatShare(MAX_ESTIMATED_SHARE_PCT)} müssen die Kosten allein nach Fläche verteilt werden, ` +
          `die Abrechnung verteilt sie aber nach Verbrauch.`,
        affectedUnits: readings.estimated.map((unit) => unit.unitId),
        amountAtStakeCents: null,
      },
    ],
  }
}
