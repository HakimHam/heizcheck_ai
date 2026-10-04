import type { BillingPeriod, Figures, UnitFigures } from '../figures'

// Scores Extracted Figures against hand-labelled (or generated) expected ones
// for the extraction eval. A figure counts as correct only on an exact match
// after normalising: amounts are compared in cents, areas at the printed
// precision, names exactly, and an expected null must be met with null.

export type FieldScore = { correct: number; total: number }

/** A figure read wrongly, at its path in the figures (e.g. `units.2.amountCents`). */
export type Miss = { path: string; expected: unknown; actual: unknown }

/** Totals, a breakdown per field (e.g. `units.amountCents`, `building.co2.totalKg`) and every miss. */
export type Score = FieldScore & { fields: Record<string, FieldScore>; misses: Miss[] }

const AREAS = new Set(['building.totalAreaM2', 'units.areaM2'])

export function scoreFigures(expected: Figures, actual: Figures): Score {
  const fields: Record<string, FieldScore> = {}
  const misses: Miss[] = []
  const count = (field: string, correct: boolean, miss?: Miss) => {
    const score = (fields[field] ??= { correct: 0, total: 0 })
    score.total++
    if (correct) score.correct++
    else if (miss) misses.push(miss)
  }
  const decimals = expected.building.areaDecimals ?? 2
  const round = (area: number) => Math.round(area * 10 ** decimals)

  function same(field: string, e: unknown, a: unknown): boolean {
    if (e === null || a === null || a === undefined) return e === (a ?? null)
    if (AREAS.has(field) && typeof e === 'number' && typeof a === 'number') return round(e) === round(a)
    if (field.endsWith('billingPeriod')) {
      const [p, q] = [e as BillingPeriod, a as BillingPeriod]
      return p.start === q.start && p.end === q.end
    }
    return e === a
  }

  /**
   * Each figure of `e` at `path`, counted under `field` (the path without
   * indexes). An object other than a Billing Period is several figures.
   */
  function compare(field: string, path: string, e: unknown, a: unknown) {
    if (e !== null && typeof e === 'object' && !field.endsWith('billingPeriod')) {
      const inner = a !== null && typeof a === 'object' ? (a as Record<string, unknown>) : {}
      for (const [key, value] of Object.entries(e)) compare(`${field}.${key}`, `${path}.${key}`, value, inner[key])
    } else {
      count(field, same(field, e, a), { path, expected: e, actual: a ?? null })
    }
  }

  const { costItems, ...building } = expected.building
  for (const [key, value] of Object.entries(building)) {
    compare(`building.${key}`, `building.${key}`, value, actual.building[key as keyof typeof building])
  }

  // Cost Items in the order printed.
  costItems.forEach((item, i) =>
    compare('building.costItems', `building.costItems.${i}`, item, actual.building.costItems[i]),
  )
  actual.building.costItems.slice(costItems.length).forEach((item, i) =>
    count('building.costItems (extra)', false, {
      path: `building.costItems.${costItems.length + i}`,
      expected: null,
      actual: item,
    }),
  )

  // Units by id, whatever order they were read in.
  const unmatched = [...actual.units]
  expected.units.forEach((unit, i) => {
    const index = unmatched.findIndex((u) => u.unitId === unit.unitId)
    const match: UnitFigures | undefined = index >= 0 ? unmatched.splice(index, 1)[0] : undefined
    compare('units', `units.${i}`, unit, match)
  })
  for (const unit of unmatched) count('units (extra)', false, { path: `units (${unit.unitId})`, expected: null, actual: unit })

  const scores = Object.values(fields)
  return {
    correct: scores.reduce((sum, s) => sum + s.correct, 0),
    total: scores.reduce((sum, s) => sum + s.total, 0),
    fields,
    misses,
  }
}
