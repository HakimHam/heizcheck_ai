// Shared by H4 and H5: per ticket 07, both are Not assessable without every
// Unit's estimated flag and the allocation method.
import type { AllocationMethod, UnitFigures } from '../../figures'
import type { RuleResult } from '../types'

type EstimatedReadings =
  | { status: 'known'; estimated: UnitFigures[] }
  | Extract<RuleResult, { status: 'not_assessable' }>

/** The Units with estimated readings, or why H4 and H5 can't tell. */
export const estimatedUnits = (
  units: UnitFigures[],
  allocationMethod: AllocationMethod | null,
): EstimatedReadings => {
  if (units.length === 0) {
    return { status: 'not_assessable', reason: 'Das Paket enthält keine Einzelabrechnungen.' }
  }
  if (allocationMethod === null) {
    return { status: 'not_assessable', reason: 'Die Verteilung (nach Verbrauch oder nur nach Fläche) fehlt.' }
  }
  const missing = units.filter((unit) => unit.estimated === null).map((unit) => unit.unitId)
  if (missing.length > 0) {
    return {
      status: 'not_assessable',
      reason: `Es fehlt, ob die Ablesewerte geschätzt sind, für: ${missing.join(', ')}.`,
    }
  }
  return { status: 'known', estimated: units.filter((unit) => unit.estimated) }
}
