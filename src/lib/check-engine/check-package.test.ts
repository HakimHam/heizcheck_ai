import { describe, expect, it } from 'vitest'
import type { BuildingProfile } from '../building-profile'
import type { BillingPeriod, Figures } from '../figures'
import { type CheckInput, type CheckResult, checkPackage, RULE_IDS } from '.'
import { cleanFigures as figures, cleanProfile as profile } from './fixtures'

const input = (
  overrides: Partial<Figures['building']> = {},
  units = figures.units,
  profileOverrides: Partial<BuildingProfile> = {},
): CheckInput => ({
  confirmedFigures: { building: { ...figures.building, ...overrides }, units },
  buildingProfile: { ...profile, ...profileOverrides },
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
    const built = ['C1', 'C2', 'C3']
    const notYet = checkPackage(input()).results.filter((r) => !built.includes(r.rule))
    expect(notYet).toHaveLength(RULE_IDS.length - built.length)
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

describe('C2: Unit areas add up to the heated area', () => {
  it('passes when the Unit areas add up exactly to the heated area', () => {
    expect(result(input(), 'C2')).toEqual({ rule: 'C2', status: 'passed' })
  })

  // 3 Units at 1 decimal: (3 + 1) × 0.05 m² = 0.2 m².
  it('allows (Units + 1) × 0.05 m² when areas are printed with 1 decimal', () => {
    expect(result(input({}, figures.units, { heatedAreaM2: 211.7 }), 'C2').status).toBe('passed')
    expect(result(input({}, figures.units, { heatedAreaM2: 211.3 }), 'C2').status).toBe('passed')
  })

  it('raises an Error beyond the tolerance, naming both totals', () => {
    expect(result(input({}, figures.units, { heatedAreaM2: 211.71 }), 'C2')).toEqual({
      rule: 'C2',
      status: 'finding',
      findings: [
        {
          severity: 'error',
          legalReference: '§7 Abs. 1 HeizkostenV',
          message: expect.stringMatching(/211,5\s?m².*211,71\s?m²/),
          affectedUnits: [],
          amountAtStakeCents: null,
        },
      ],
    })
  })

  // 3 Units at 2 decimals: (3 + 1) × 0.005 m² = 0.02 m².
  it('allows (Units + 1) × 0.005 m² when areas are printed with 2 decimals', () => {
    const twoDecimals = { areaDecimals: 2 as const }
    expect(result(input(twoDecimals, figures.units, { heatedAreaM2: 211.52 }), 'C2').status).toBe('passed')
    expect(result(input(twoDecimals, figures.units, { heatedAreaM2: 211.53 }), 'C2').status).toBe('finding')
  })

  // 3 Units at 0 decimals: (3 + 1) × 0.5 m² = 2 m². A fixed ±0.01 m² would fail these.
  it('allows (Units + 1) × 0.5 m² for whole-number areas', () => {
    const units = [
      { ...figures.units[0], areaM2: 70 },
      { ...figures.units[1], areaM2: 71 },
      { ...figures.units[2], areaM2: 70 },
    ]
    const whole = { areaDecimals: 0 as const }
    expect(result(input(whole, units, { heatedAreaM2: 212.4 }), 'C2').status).toBe('passed')
    expect(result(input(whole, units, { heatedAreaM2: 213 }), 'C2').status).toBe('passed')
    expect(result(input(whole, units, { heatedAreaM2: 209 }), 'C2').status).toBe('passed')
    expect(result(input(whole, units, { heatedAreaM2: 213.01 }), 'C2').status).toBe('finding')
  })

  it('compares against the heated area, not the living area', () => {
    expect(result(input({}, figures.units, { livingAreaM2: 190 }), 'C2').status).toBe('passed')
  })

  it('is Not assessable without the heated area', () => {
    expect(result(input({}, figures.units, { heatedAreaM2: null }), 'C2')).toEqual({
      rule: 'C2',
      status: 'not_assessable',
      reason: expect.stringContaining('beheizte Fläche'),
    })
  })

  it('is Not assessable without the printed area precision', () => {
    expect(result(input({ areaDecimals: null }), 'C2')).toEqual({
      rule: 'C2',
      status: 'not_assessable',
      reason: expect.stringContaining('Nachkommastellen'),
    })
  })

  it('is Not assessable when a Unit area is missing, naming the Unit', () => {
    const units = [...figures.units.slice(0, 2), { ...figures.units[2], areaM2: null }]
    expect(result(input({}, units), 'C2')).toEqual({
      rule: 'C2',
      status: 'not_assessable',
      reason: expect.stringContaining('WE 03'),
    })
  })

  it('is Not assessable for a package without Unit Statements', () => {
    expect(result(input({}, []), 'C2').status).toBe('not_assessable')
  })
})

describe('C3: every statement shares the Billing Period', () => {
  const withPeriods = (periods: Record<string, BillingPeriod | null>) =>
    figures.units.map((u) => (u.unitId in periods ? { ...u, billingPeriod: periods[u.unitId] } : u))

  it('passes when every Unit Statement has the Building Statement’s Billing Period', () => {
    expect(result(input(), 'C3')).toEqual({ rule: 'C3', status: 'passed' })
  })

  it('raises an Error listing the Units whose Billing Period differs', () => {
    const units = withPeriods({
      'WE 02': { start: '2025-01-01', end: '2025-12-30' },
      'WE 03': { start: '2024-01-01', end: '2024-12-31' },
    })
    expect(result(input({}, units), 'C3')).toEqual({
      rule: 'C3',
      status: 'finding',
      findings: [
        {
          severity: 'error',
          legalReference: '§556 Abs. 3 BGB',
          message: expect.stringContaining('01.01.2025 – 31.12.2025'),
          affectedUnits: ['WE 02', 'WE 03'],
          amountAtStakeCents: null,
        },
      ],
    })
  })

  it('is Not assessable without the Building Statement’s Billing Period', () => {
    expect(result(input({ billingPeriod: null }), 'C3')).toEqual({
      rule: 'C3',
      status: 'not_assessable',
      reason: expect.stringContaining('Gesamtabrechnung'),
    })
  })

  it('is Not assessable when a Unit’s Billing Period is missing, naming the Unit', () => {
    const units = withPeriods({ 'WE 01': null })
    expect(result(input({}, units), 'C3')).toEqual({
      rule: 'C3',
      status: 'not_assessable',
      reason: expect.stringContaining('WE 01'),
    })
  })

  it('still raises the Error when one Unit differs and another’s Billing Period is missing', () => {
    const units = withPeriods({ 'WE 01': null, 'WE 02': { start: '2024-01-01', end: '2024-12-31' } })
    const r = result(input({}, units), 'C3')
    expect(r.status === 'finding' && r.findings[0].affectedUnits).toEqual(['WE 02'])
  })

  it('is Not assessable for a package without Unit Statements', () => {
    expect(result(input({}, []), 'C3').status).toBe('not_assessable')
  })
})
