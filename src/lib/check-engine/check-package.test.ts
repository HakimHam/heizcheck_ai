import { describe, expect, it } from 'vitest'
import type { BuildingProfile } from '../building-profile'
import type { Figures, UnitFigures } from '../figures'
import { type CheckInput, type CheckResult, checkPackage, RULE_IDS } from '.'

const unit = (unitId: string, amountCents: number): UnitFigures => ({
  unitId,
  billingPeriod: { start: '2025-01-01', end: '2025-12-31' },
  areaM2: 70.5,
  consumption: 1200,
  amountCents,
  estimated: false,
})

// Three Units whose amounts add up exactly to the building total.
const figures: Figures = {
  building: {
    billingPeriod: { start: '2025-01-01', end: '2025-12-31' },
    costItems: [{ name: 'Brennstoffkosten', amountCents: 300_000 }],
    totalCostCents: 300_000,
    heatingConsumptionSharePct: 70,
    hotWaterConsumptionSharePct: 70,
    allocationMethod: 'consumption_split',
    totalAreaM2: 211.5,
    areaDecimals: 1,
    fuel: { type: 'Erdgas', quantity: 30_000, unit: 'kWh' },
    co2: {
      totalKg: 6_000,
      statedKgPerM2Year: 28.4,
      statedTier: 5,
      statedSplit: { landlordPct: 40, tenantPct: 60 },
      costCents: 25_000,
      statedReduction: 'none',
    },
  },
  units: [unit('WE 01', 100_000), unit('WE 02', 120_000), unit('WE 03', 80_000)],
}

const profile: BuildingProfile = {
  livingAreaM2: 211.5,
  heatedAreaM2: 211.5,
  mandatory70Pct: true,
  residential: true,
  co2Reduction: 'none',
}

const input = (overrides: Partial<Figures['building']> = {}, units = figures.units): CheckInput => ({
  confirmedFigures: { building: { ...figures.building, ...overrides }, units },
  buildingProfile: profile,
  dispatchDate: '2026-03-15',
})

const result = (checkInput: CheckInput, rule: string): CheckResult => {
  const found = checkPackage(checkInput).results.find((r) => r.rule === rule)
  if (!found) throw new Error(`no result for ${rule}`)
  return found
}

describe('checkPackage', () => {
  it('returns exactly one Check Result per rule, in catalogue order', () => {
    expect(checkPackage(input()).results.map((r) => r.rule)).toEqual([
      'C1', 'C2', 'C3', 'H1', 'H2', 'H3', 'H4', 'H5', 'K1', 'K2', 'B1',
    ])
    expect(RULE_IDS).toHaveLength(11)
  })

  it('stamps the Ruleset version', () => {
    expect(checkPackage(input()).rulesetVersion).toMatch(/\S/)
  })

  it('is deterministic for the same input', () => {
    expect(checkPackage(input())).toEqual(checkPackage(input()))
  })

  it('reports the rules not built yet as Not assessable, with a reason', () => {
    const notYet = checkPackage(input()).results.filter((r) => r.rule !== 'C1')
    expect(notYet).toHaveLength(10)
    for (const r of notYet) {
      expect(r).toEqual({ rule: r.rule, status: 'not_assessable', reason: expect.stringMatching(/\S/) })
    }
  })
})

describe('C1: Unit amounts add up to the building total', () => {
  it('passes when the Unit amounts add up exactly', () => {
    expect(result(input(), 'C1')).toEqual({ rule: 'C1', status: 'passed' })
  })

  it('passes when the difference is exactly €0.05 per Unit', () => {
    expect(result(input({ totalCostCents: 300_015 }), 'C1').status).toBe('passed')
    expect(result(input({ totalCostCents: 299_985 }), 'C1').status).toBe('passed')
  })

  it('raises an Error one cent beyond the tolerance, with the difference at stake', () => {
    expect(result(input({ totalCostCents: 300_016 }), 'C1')).toEqual({
      rule: 'C1',
      status: 'finding',
      findings: [
        {
          severity: 'error',
          legalReference: '§6 Abs. 1 HeizkostenV',
          message: expect.stringMatching(/0,16\s€/),
          affectedUnits: ['WE 01', 'WE 02', 'WE 03'],
          amountAtStakeCents: 16,
        },
      ],
    })
  })

  it('states the difference as a positive amount when the Units add up to more', () => {
    const r = result(input({ totalCostCents: 290_000 }), 'C1')
    expect(r.status === 'finding' && r.findings[0].amountAtStakeCents).toBe(10_000)
  })

  it('is Not assessable without the building total', () => {
    expect(result(input({ totalCostCents: null }), 'C1')).toEqual({
      rule: 'C1',
      status: 'not_assessable',
      reason: expect.stringContaining('Gesamtkosten'),
    })
  })

  it('is Not assessable when a Unit amount is missing, naming the Unit', () => {
    const units = [...figures.units.slice(0, 2), { ...figures.units[2], amountCents: null }]
    expect(result(input({}, units), 'C1')).toEqual({
      rule: 'C1',
      status: 'not_assessable',
      reason: expect.stringContaining('WE 03'),
    })
  })

  it('is Not assessable for a package without Unit Statements', () => {
    expect(result(input({}, []), 'C1').status).toBe('not_assessable')
  })
})
