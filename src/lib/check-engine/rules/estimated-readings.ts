// Shared by H4 and H5: both read every Unit's estimated flag.
import type { UnitFigures } from '../../figures'

export const NO_UNIT_STATEMENTS = {
  status: 'not_assessable',
  reason: 'Das Paket enthält keine Einzelabrechnungen.',
} as const

/** Not assessable naming the Units without an estimated flag, or null when every Unit has one. */
export const missingEstimatedFlags = (units: UnitFigures[]) => {
  const missing = units.filter((unit) => unit.estimated === null).map((unit) => unit.unitId)
  return missing.length === 0
    ? null
    : ({
        status: 'not_assessable',
        reason: `Es fehlt, ob die Ablesewerte geschätzt sind, für: ${missing.join(', ')}.`,
      } as const)
}

export const withEstimatedReadings = (units: UnitFigures[]) => units.filter((unit) => unit.estimated === true)
