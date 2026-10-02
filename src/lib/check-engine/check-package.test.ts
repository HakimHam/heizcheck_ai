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
    const built = ['C1', 'C2', 'C3', 'H1', 'H2', 'H3']
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

describe('H1: heating consumption share (§7 Abs. 1 HeizkostenV)', () => {
  const h1 = (share: number | null, mandatory70Pct: boolean | null) =>
    result(input({ heatingConsumptionSharePct: share }, figures.units, { mandatory70Pct }), 'H1')

  const error = {
    severity: 'error',
    legalReference: '§7 Abs. 1 HeizkostenV',
    message: expect.stringMatching(/\S/),
    affectedUnits: [],
    amountAtStakeCents: null,
  }
  const warning = {
    severity: 'warning',
    legalReference: '§7 Abs. 1 Satz 2 HeizkostenV',
    message: expect.stringContaining('Gebäudeprofil'),
    affectedUnits: [],
    amountAtStakeCents: null,
  }

  describe('when the Building Profile requires exactly 70%', () => {
    it('passes at exactly 70%', () => {
      expect(h1(70, true)).toEqual({ rule: 'H1', status: 'passed' })
    })

    it('raises an Error at 50%, which is otherwise lawful', () => {
      expect(h1(50, true)).toEqual({
        rule: 'H1',
        status: 'finding',
        findings: [
          { ...error, legalReference: '§7 Abs. 1 Satz 2 HeizkostenV', message: expect.stringContaining('genau 70') },
        ],
      })
    })

    it('raises an Error just below 70%', () => {
      expect(h1(69.9, true).status).toBe('finding')
    })
  })

  describe('when the Building Profile says 70% is not required', () => {
    it('passes at exactly 50% and exactly 70%', () => {
      expect(h1(50, false)).toEqual({ rule: 'H1', status: 'passed' })
      expect(h1(70, false)).toEqual({ rule: 'H1', status: 'passed' })
    })

    it('raises an Error just outside 50–70%', () => {
      expect(h1(49.9, false)).toEqual({
        rule: 'H1',
        status: 'finding',
        findings: [{ ...error, message: expect.stringContaining('50 % und 70 %') }],
      })
      expect(h1(70.1, false).status).toBe('finding')
    })
  })

  describe('when the Building Profile leaves the 70% flag unset', () => {
    it('warns that exactly 70% may be required, prompting to complete the Building Profile', () => {
      expect(h1(60, null)).toEqual({ rule: 'H1', status: 'finding', findings: [warning] })
      expect(h1(50, null)).toEqual({ rule: 'H1', status: 'finding', findings: [warning] })
    })

    it('raises the Error before the Warning when the share is outside 50–70%', () => {
      expect(h1(75, null)).toEqual({ rule: 'H1', status: 'finding', findings: [error, warning] })
    })

    it('passes at exactly 70%, which is lawful either way', () => {
      expect(h1(70, null)).toEqual({ rule: 'H1', status: 'passed' })
    })
  })

  it('is Not assessable without the heating consumption share', () => {
    expect(h1(null, true)).toEqual({
      rule: 'H1',
      status: 'not_assessable',
      reason: expect.stringContaining('Heizung'),
    })
  })
})

describe('H2: hot water consumption share (§8 HeizkostenV)', () => {
  const h2 = (share: number | null) => result(input({ hotWaterConsumptionSharePct: share }), 'H2')

  it('passes at exactly 50% and exactly 70%', () => {
    expect(h2(50)).toEqual({ rule: 'H2', status: 'passed' })
    expect(h2(70)).toEqual({ rule: 'H2', status: 'passed' })
  })

  it('raises an Error just outside 50–70%', () => {
    expect(h2(70.1)).toEqual({
      rule: 'H2',
      status: 'finding',
      findings: [
        {
          severity: 'error',
          legalReference: '§8 Abs. 1 HeizkostenV',
          message: expect.stringContaining('70,1 %'),
          affectedUnits: [],
          amountAtStakeCents: null,
        },
      ],
    })
    expect(h2(49.9).status).toBe('finding')
  })

  it('is Not assessable when the package has no hot water share', () => {
    expect(h2(null)).toEqual({
      rule: 'H2',
      status: 'not_assessable',
      reason: expect.stringContaining('Warmwasser'),
    })
  })

  it('ignores the 70% flag, which only applies to heating', () => {
    expect(result(input({ hotWaterConsumptionSharePct: 50 }, figures.units, { mandatory70Pct: true }), 'H2').status).toBe(
      'passed',
    )
  })
})

describe('H3: Cost Items are Eligible Cost Types (§7 Abs. 2 HeizkostenV)', () => {
  const h3 = (...costItems: Figures['building']['costItems']) => result(input({ costItems }), 'H3')

  it('passes when every Cost Item is a known eligible Minol name', () => {
    expect(
      h3(
        { name: 'Brennstoffkosten', amountCents: 300_000 },
        { name: 'Betriebsstrom', amountCents: 18_450 },
        { name: 'Wartung', amountCents: 32_900 },
        { name: 'Immissionsmessung', amountCents: 6_840 },
        { name: 'Verbrauchsabrechnung Minol', amountCents: 49_500 },
      ),
    ).toEqual({ rule: 'H3', status: 'passed' })
  })

  it('ignores differences in whitespace and case', () => {
    expect(h3({ name: '  VERBRAUCHSABRECHNUNG \t  minol ', amountCents: 49_500 })).toEqual({
      rule: 'H3',
      status: 'passed',
    })
  })

  it('raises an Error for a Cost Item that is not eligible, with its amount at stake', () => {
    expect(h3({ name: 'Brennstoffkosten', amountCents: 300_000 }, { name: 'Reparaturkosten', amountCents: 41_250 })).toEqual({
      rule: 'H3',
      status: 'finding',
      findings: [
        {
          severity: 'error',
          legalReference: '§7 Abs. 2 HeizkostenV',
          message: expect.stringContaining('„Reparaturkosten“'),
          affectedUnits: [],
          amountAtStakeCents: 41_250,
        },
      ],
    })
  })

  it('has no amount at stake for an ineligible Cost Item without an amount', () => {
    const r = h3({ name: 'reparaturkosten', amountCents: null })
    expect(r.status === 'finding' && r.findings[0]).toMatchObject({ severity: 'error', amountAtStakeCents: null })
  })

  it('raises a Warning naming a Cost Item that is not in the mapping table exactly as written', () => {
    expect(h3({ name: 'Sonderreinigung  Dach', amountCents: 9_900 })).toEqual({
      rule: 'H3',
      status: 'finding',
      findings: [
        {
          severity: 'warning',
          legalReference: '§7 Abs. 2 HeizkostenV',
          message: expect.stringContaining('„Sonderreinigung  Dach“'),
          affectedUnits: [],
          amountAtStakeCents: 9_900,
        },
      ],
    })
  })

  it('normalises only whitespace and case: any other difference is an unknown name', () => {
    for (const name of ['Brennstoffkosten.', 'Brennstoff-Kosten', 'Brennstoffkost', 'Geraetemiete']) {
      const r = h3({ name, amountCents: 100 })
      expect(r.status === 'finding' && r.findings.map((f) => f.severity)).toEqual(['warning'])
    }
  })

  it('lists Errors before Warnings', () => {
    const r = h3(
      { name: 'Unbekannte Position', amountCents: 100 },
      { name: 'Verwaltungskosten', amountCents: 200 },
      { name: 'Brennstoffkosten', amountCents: 300 },
    )
    expect(r.status === 'finding' && r.findings.map((f) => [f.severity, f.amountAtStakeCents])).toEqual([
      ['error', 200],
      ['warning', 100],
    ])
  })

  it('is Not assessable when the Building Statement lists no Cost Items', () => {
    expect(h3()).toEqual({ rule: 'H3', status: 'not_assessable', reason: expect.stringContaining('Kostenpositionen') })
  })
})
