// Shared by C2 and H4. Areas are compared in whole thousandths of a m², so no floats are compared.
import type { UnitFigures } from '../../figures'

export const toMilli = (areaM2: number) => Math.round(areaM2 * 1000)

export const sumAreaMilli = (units: UnitFigures[]) => units.reduce((total, unit) => total + toMilli(unit.areaM2 ?? 0), 0)

/** Not assessable naming the Units without an area, or null when every Unit has one. */
export const missingAreas = (units: UnitFigures[]) => {
  const missing = units.filter((unit) => unit.areaM2 === null).map((unit) => unit.unitId)
  return missing.length === 0
    ? null
    : ({ status: 'not_assessable', reason: `Die Fläche fehlt für: ${missing.join(', ')}.` } as const)
}
