import { describe, expect, it } from 'vitest'
import { cleanFigures } from '../check-engine/fixtures'
import type { Figures } from '../figures'
import { scoreFigures } from './eval-score'

const copy = (): Figures => structuredClone(cleanFigures)

describe('scoring extracted figures against the expected ones', () => {
  it('counts every figure correct when they match, with a breakdown per field', () => {
    const score = scoreFigures(cleanFigures, copy())
    expect(score.correct).toBe(score.total)
    // 7 building figures and the fuel as 3, 1 Cost Item × 2, 7 CO₂ figures (split as 2), 3 Units × 6.
    expect(score.total).toBe(10 + 2 + 7 + 18)
    expect(Object.keys(score.fields)).toEqual(
      expect.arrayContaining([
        'building.totalCostCents',
        'building.costItems.name',
        'building.costItems.amountCents',
        'building.fuel.quantity',
        'building.co2.totalKg',
        'building.co2.statedSplit.landlordPct',
        'units.amountCents',
        'units.unitId',
      ]),
    )
    expect(score.fields['units.amountCents']).toEqual({ correct: 3, total: 3 })
  })

  it('counts a wrong figure against its field only', () => {
    const actual = copy()
    actual.units[1].amountCents = 120_001
    actual.building.co2.statedTier = 6
    const score = scoreFigures(cleanFigures, actual)
    expect(score.total - score.correct).toBe(2)
    expect(score.fields['units.amountCents']).toEqual({ correct: 2, total: 3 })
    expect(score.fields['building.co2.statedTier']).toEqual({ correct: 0, total: 1 })
    expect(score.misses).toEqual([
      { path: 'building.co2.statedTier', expected: 5, actual: 6 },
      { path: 'units.1.amountCents', expected: 120_000, actual: 120_001 },
    ])
  })

  it('counts an expected null met with null as correct, and null against a value as wrong', () => {
    const expected = copy()
    expected.building.co2.totalKg = null
    expected.building.fuel = null
    const actual = copy()
    actual.building.co2.totalKg = null
    actual.building.fuel = null
    actual.building.totalCostCents = null
    const score = scoreFigures(expected, actual)
    expect(score.fields['building.co2.totalKg']).toEqual({ correct: 1, total: 1 })
    expect(score.fields['building.fuel']).toEqual({ correct: 1, total: 1 })
    expect(score.fields['building.totalCostCents']).toEqual({ correct: 0, total: 1 })

    const guessed = copy()
    expect(scoreFigures(expected, guessed).fields['building.co2.totalKg']).toEqual({ correct: 0, total: 1 })
    expect(scoreFigures(expected, guessed).fields['building.fuel']).toEqual({ correct: 0, total: 1 })
  })

  it('compares areas at the printed precision', () => {
    const actual = copy()
    actual.building.totalAreaM2 = 211.50000000001
    actual.units[0].areaM2 = 70.6
    const score = scoreFigures(cleanFigures, actual)
    expect(score.fields['building.totalAreaM2']).toEqual({ correct: 1, total: 1 })
    expect(score.fields['units.areaM2']).toEqual({ correct: 2, total: 3 })
  })

  it('compares Cost Item names exactly', () => {
    const actual = copy()
    actual.building.costItems[0].name = 'Brennstoffkosten '
    expect(scoreFigures(cleanFigures, actual).fields['building.costItems.name']).toEqual({ correct: 0, total: 1 })
  })

  it('matches Units by id, counting a missing Unit and an extra one as wrong', () => {
    const actual = copy()
    actual.units.reverse()
    expect(scoreFigures(cleanFigures, actual).correct).toBe(scoreFigures(cleanFigures, actual).total)

    actual.units = actual.units.filter((u) => u.unitId !== 'WE 02')
    actual.units.push({ ...actual.units[0], unitId: 'WE 99' })
    const score = scoreFigures(cleanFigures, actual)
    expect(score.fields['units.amountCents']).toEqual({ correct: 2, total: 3 })
    expect(score.fields['units (extra)']).toEqual({ correct: 0, total: 1 })
    expect(score.total).toBe(37 + 1)
  })

  it('counts a missing or extra Cost Item as wrong', () => {
    const actual = copy()
    actual.building.costItems.push({ name: 'Wartung', amountCents: 100 })
    expect(scoreFigures(cleanFigures, actual).fields['building.costItems (extra)']).toEqual({ correct: 0, total: 1 })
    actual.building.costItems = []
    expect(scoreFigures(cleanFigures, actual).fields['building.costItems.name']).toEqual({ correct: 0, total: 1 })
  })
})
