import type { AreaDecimals } from '../../figures'
import type { Rule } from '../types'

// Areas are compared in whole thousandths of a m², so no floats are compared.
const toMilli = (areaM2: number) => Math.round(areaM2 * 1000)

/** Half the smallest printed step, in thousandths of a m²: 0.005, 0.05 or 0.5 m². */
const HALF_STEP_MILLI: Record<AreaDecimals, number> = { 2: 5, 1: 50, 0: 500 }

const AREA = new Intl.NumberFormat('de-DE', { maximumFractionDigits: 3 })
const formatArea = (milli: number) => `${AREA.format(milli / 1000)} m²`

/**
 * C2: the Unit areas add up to the Building Profile's heated area, within
 * (Units + 1) × half the smallest printed step. Only the heated area counts:
 * CO₂ may correctly use the living area instead.
 */
export const c2: Rule = ({ confirmedFigures: { building, units }, buildingProfile }) => {
  if (units.length === 0) {
    return { status: 'not_assessable', reason: 'Das Paket enthält keine Einzelabrechnungen.' }
  }
  if (buildingProfile.heatedAreaM2 === null) {
    return {
      status: 'not_assessable',
      reason: 'Die beheizte Fläche fehlt im Gebäudeprofil.',
    }
  }
  if (building.areaDecimals === null) {
    return {
      status: 'not_assessable',
      reason: 'Es fehlt, mit wie vielen Nachkommastellen die Flächen gedruckt sind.',
    }
  }
  const missing = units.filter((unit) => unit.areaM2 === null).map((unit) => unit.unitId)
  if (missing.length > 0) {
    return {
      status: 'not_assessable',
      reason: `Die Fläche fehlt für: ${missing.join(', ')}.`,
    }
  }

  const heatedMilli = toMilli(buildingProfile.heatedAreaM2)
  const unitSumMilli = units.reduce((total, unit) => total + toMilli(unit.areaM2 ?? 0), 0)
  const toleranceMilli = (units.length + 1) * HALF_STEP_MILLI[building.areaDecimals]
  if (Math.abs(unitSumMilli - heatedMilli) <= toleranceMilli) return { status: 'passed' }

  return {
    status: 'finding',
    findings: [
      {
        severity: 'error',
        legalReference: '§7 Abs. 1 HeizkostenV',
        message:
          `Die Flächen der Nutzeinheiten ergeben zusammen ${formatArea(unitSumMilli)}, ` +
          `die beheizte Fläche laut Gebäudeprofil beträgt ${formatArea(heatedMilli)}. ` +
          `Die Abweichung übersteigt die Rundungstoleranz von ${formatArea(toleranceMilli)}.`,
        affectedUnits: [],
        amountAtStakeCents: null,
      },
    ],
  }
}
