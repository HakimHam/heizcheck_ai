import { describe, expect, it } from 'vitest'
import type { BuildingProfile } from '../building-profile'
import type { BillingPeriod, Figures } from '../figures'
import { type CheckInput, type CheckResult, checkPackage, RULE_IDS } from '.'
import { cleanFigures as figures, cleanProfile as profile } from './fixtures'
import { CO2_TIERS } from './rules/co2'

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

  it('passes every rule for the clean package', () => {
    expect(checkPackage(input()).results.filter((r) => r.status !== 'passed')).toEqual([])
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

describe('H4: area-only split when too much was estimated (§9a Abs. 2 HeizkostenV)', () => {
  // 200 m² in all: WE 01 50 m², WE 02 100 m², WE 03 50 m².
  const units = (estimated: Record<string, boolean | null>, areas: Record<string, number | null> = {}) =>
    figures.units.map((u, i) => ({
      ...u,
      areaM2: u.unitId in areas ? areas[u.unitId] : [50, 100, 50][i],
      estimated: u.unitId in estimated ? estimated[u.unitId] : false,
    }))
  const h4 = (
    estimated: Record<string, boolean | null>,
    allocationMethod: Figures['building']['allocationMethod'] = 'consumption_split',
    areas: Record<string, number | null> = {},
  ) => result(input({ allocationMethod }, units(estimated, areas)), 'H4')

  it('passes when no reading was estimated', () => {
    expect(h4({})).toEqual({ rule: 'H4', status: 'passed' })
  })

  it('passes at exactly 25% of the area estimated', () => {
    expect(h4({ 'WE 01': true })).toEqual({ rule: 'H4', status: 'passed' })
  })

  it('raises an Error just above 25% when the costs are still split by consumption', () => {
    expect(h4({ 'WE 01': true }, 'consumption_split', { 'WE 01': 50.1 })).toEqual({
      rule: 'H4',
      status: 'finding',
      findings: [
        {
          severity: 'error',
          legalReference: '§9a Abs. 2 HeizkostenV',
          message: expect.stringMatching(/25,04\s%/),
          affectedUnits: ['WE 01'],
          amountAtStakeCents: null,
        },
      ],
    })
  })

  it('computes the share as the area of Units with estimated readings ÷ the total area', () => {
    const r = h4({ 'WE 01': true, 'WE 03': true })
    expect(r.status === 'finding' && r.findings[0]).toMatchObject({
      message: expect.stringMatching(/50\s%/),
      affectedUnits: ['WE 01', 'WE 03'],
    })
  })

  it('passes above 25% when the costs are split by area only', () => {
    expect(h4({ 'WE 01': true, 'WE 02': true }, 'area_only')).toEqual({ rule: 'H4', status: 'passed' })
  })

  it('is Not assessable when a Unit’s estimated flag is missing, naming the Unit', () => {
    expect(h4({ 'WE 02': null })).toEqual({
      rule: 'H4',
      status: 'not_assessable',
      reason: expect.stringContaining('WE 02'),
    })
  })

  it('still raises the Error when the Units known to be estimated already exceed 25%', () => {
    const r = h4({ 'WE 01': true, 'WE 02': true, 'WE 03': null })
    expect(r.status === 'finding' && r.findings[0]).toMatchObject({
      severity: 'error',
      message: expect.stringMatching(/mindestens 75\s%/),
      affectedUnits: ['WE 01', 'WE 02'],
    })
  })

  it('is Not assessable when the share known so far is 25% or less and a flag is missing', () => {
    expect(h4({ 'WE 01': true, 'WE 03': null })).toEqual({
      rule: 'H4',
      status: 'not_assessable',
      reason: expect.stringContaining('WE 03'),
    })
  })

  it('passes with missing flags when the costs are split by area only', () => {
    expect(h4({ 'WE 01': true, 'WE 02': null }, 'area_only')).toEqual({ rule: 'H4', status: 'passed' })
  })

  it('is Not assessable without the allocation method', () => {
    expect(h4({}, null)).toEqual({ rule: 'H4', status: 'not_assessable', reason: expect.stringContaining('Verteilung') })
  })

  it('is Not assessable when a Unit area is missing, naming the Unit', () => {
    expect(h4({ 'WE 01': true }, 'consumption_split', { 'WE 03': null })).toEqual({
      rule: 'H4',
      status: 'not_assessable',
      reason: expect.stringContaining('WE 03'),
    })
  })

  it('is Not assessable for a package without Unit Statements', () => {
    expect(result(input({}, []), 'H4').status).toBe('not_assessable')
  })
})

describe('H5: estimated readings (§9a Abs. 1 HeizkostenV)', () => {
  const h5 = (estimated: Record<string, boolean | null>, building: Partial<Figures['building']> = {}) =>
    result(
      input(
        building,
        figures.units.map((u) => ({ ...u, estimated: u.unitId in estimated ? estimated[u.unitId] : false })),
      ),
      'H5',
    )

  it('passes when no reading was estimated', () => {
    expect(h5({})).toEqual({ rule: 'H5', status: 'passed' })
  })

  it('raises a Warning listing every Unit with estimated readings', () => {
    expect(h5({ 'WE 01': true, 'WE 03': true })).toEqual({
      rule: 'H5',
      status: 'finding',
      findings: [
        {
          severity: 'warning',
          legalReference: '§9a Abs. 1 HeizkostenV',
          message: expect.stringMatching(/WE 01, WE 03/),
          affectedUnits: ['WE 01', 'WE 03'],
          amountAtStakeCents: null,
        },
      ],
    })
  })

  it('warns even when the costs are split by area only', () => {
    expect(h5({ 'WE 02': true }, { allocationMethod: 'area_only' }).status).toBe('finding')
  })

  it('is Not assessable when a Unit’s estimated flag is missing, naming the Unit', () => {
    expect(h5({ 'WE 01': true, 'WE 02': null })).toEqual({
      rule: 'H5',
      status: 'not_assessable',
      reason: expect.stringContaining('WE 02'),
    })
  })

  it('still warns without the allocation method, which it doesn’t need', () => {
    const r = h5({ 'WE 01': true }, { allocationMethod: null })
    expect(r.status === 'finding' && r.findings[0].affectedUnits).toEqual(['WE 01'])
  })

  it('is Not assessable for a package without Unit Statements', () => {
    expect(result(input({}, []), 'H5').status).toBe('not_assessable')
  })
})

describe('B1: the §556 Abs. 3 BGB deadline', () => {
  const b1 = (periodEnd: string | null, dispatchDate: string) =>
    result(
      {
        ...input({ billingPeriod: periodEnd ? { start: '2025-01-01', end: periodEnd } : null }),
        dispatchDate,
      },
      'B1',
    )

  it('passes when the Dispatch Date is 29 days before the deadline', () => {
    expect(b1('2025-12-31', '2026-12-02')).toEqual({ rule: 'B1', status: 'passed' })
  })

  it('raises a Warning when the Dispatch Date is exactly 28 days before the deadline', () => {
    expect(b1('2025-12-31', '2026-12-03')).toEqual({
      rule: 'B1',
      status: 'finding',
      findings: [
        {
          severity: 'warning',
          legalReference: '§556 Abs. 3 BGB',
          message: expect.stringMatching(/31\.12\.2026.*28 Tage/),
          affectedUnits: [],
          amountAtStakeCents: null,
        },
      ],
    })
  })

  it('raises a Warning when the Dispatch Date is the deadline day', () => {
    const r = b1('2025-12-31', '2026-12-31')
    expect(r.status === 'finding' && r.findings[0].severity).toBe('warning')
  })

  it('raises an Error when the Dispatch Date is the day after the deadline', () => {
    expect(b1('2025-12-31', '2027-01-01')).toEqual({
      rule: 'B1',
      status: 'finding',
      findings: [
        {
          severity: 'error',
          legalReference: '§556 Abs. 3 BGB',
          message: expect.stringMatching(/31\.12\.2026/),
          affectedUnits: [],
          amountAtStakeCents: null,
        },
      ],
    })
  })

  it('adds 12 calendar months, not 365 days, across a leap year', () => {
    // 365 days after 31.03.2027 would be 30.03.2028; the deadline is 31.03.2028.
    const r = b1('2027-03-31', '2028-03-31')
    expect(r.status === 'finding' && r.findings[0].severity).toBe('warning')
  })

  it('keeps the 28th when a period ending on 28 Feb runs into a leap year', () => {
    expect(b1('2023-02-28', '2024-02-28').status).toBe('finding')
    const r = b1('2023-02-28', '2024-02-29')
    expect(r.status === 'finding' && r.findings[0].severity).toBe('error')
  })

  it('takes the last day of February when a period ends on 29 Feb', () => {
    const onDeadline = b1('2024-02-29', '2025-02-28')
    expect(onDeadline.status === 'finding' && onDeadline.findings[0].severity).toBe('warning')
    const after = b1('2024-02-29', '2025-03-01')
    expect(after.status === 'finding' && after.findings[0].severity).toBe('error')
  })

  it('keeps the 31st for a period ending on the 31st of a month', () => {
    const onDeadline = b1('2025-05-31', '2026-05-31')
    expect(onDeadline.status === 'finding' && onDeadline.findings[0].severity).toBe('warning')
    const after = b1('2025-05-31', '2026-06-01')
    expect(after.status === 'finding' && after.findings[0].severity).toBe('error')
  })

  it('judges only the Dispatch Date passed in, never today', () => {
    // Long past by the system clock, yet well within the deadline for that Dispatch Date.
    expect(b1('2000-12-31', '2001-03-15').status).toBe('passed')
  })

  it('is Not assessable without the Building Statement’s Billing Period', () => {
    expect(b1(null, '2026-03-15')).toEqual({
      rule: 'B1',
      status: 'not_assessable',
      reason: expect.stringContaining('Abrechnungszeitraum'),
    })
  })
})

describe('K1: the CO₂ cost split follows the CO2KostAufG tier', () => {
  // A living area of 100 m² makes the kg CO₂/m²/year one hundredth of the total kg.
  // Unless given, the statement prints the kg/m²/year the figures produce and the tier its split belongs to.
  const k1 = (
    co2: Partial<Figures['building']['co2']>,
    {
      billingPeriod = figures.building.billingPeriod,
      livingAreaM2 = 100,
      co2Reduction = 'none',
    }: {
      billingPeriod?: BillingPeriod | null
      livingAreaM2?: number | null
      co2Reduction?: BuildingProfile['co2Reduction']
    } = {},
  ) => {
    const { totalKg, statedSplit } = { ...figures.building.co2, ...co2 }
    const stated = {
      statedKgPerM2Year: !livingAreaM2
        ? figures.building.co2.statedKgPerM2Year
        : totalKg === null
          ? null
          : totalKg / livingAreaM2,
      statedTier: CO2_TIERS.find((t) => t.landlordPct === statedSplit?.landlordPct)?.tier ?? null,
    }
    return result(
      input({ billingPeriod, co2: { ...figures.building.co2, ...stated, ...co2 } }, figures.units, {
        livingAreaM2,
        co2Reduction,
      }),
      'K1',
    )
  }
  const split = (landlordPct: number) => ({ statedSplit: { landlordPct, tenantPct: 100 - landlordPct } })

  it('passes when the stated split matches the tier', () => {
    expect(result(input(), 'K1')).toEqual({ rule: 'K1', status: 'passed' })
  })

  it('raises an Error when the Tenant and Property Manager shares are swapped, with the difference at stake', () => {
    // 2,840 kg on 100 m² is 28.4 kg/m²/year, tier 5: Property Manager 40%, Tenants 60%.
    expect(k1({ totalKg: 2_840, statedSplit: { landlordPct: 60, tenantPct: 40 }, statedTier: 5, costCents: 25_000 })).toEqual({
      rule: 'K1',
      status: 'finding',
      findings: [
        {
          severity: 'error',
          legalReference: '§5 Abs. 1 CO2KostAufG',
          message: expect.stringMatching(/28,4 kg.*Stufe 5.*40 %.*60 %/),
          affectedUnits: [],
          amountAtStakeCents: 5_000,
        },
      ],
    })
    expect(k1({ totalKg: 2_840, ...split(40) }).status).toBe('passed')
  })

  // [lower limit in kg CO₂/m²/year, the Property Manager's % from it and just below it], from the CO2KostAufG annex.
  const edges: [number, number, number][] = [
    [12, 10, 0], [17, 20, 10], [22, 30, 20], [27, 40, 30], [32, 50, 40],
    [37, 60, 50], [42, 70, 60], [47, 80, 70], [52, 95, 80],
  ]
  for (const [limit, from, below] of edges) {
    it(`puts ${limit},0 kg/m²/year in the tier from ${limit} and ${limit - 0.1} kg in the one below`, () => {
      expect(k1({ totalKg: limit * 100, ...split(from) }).status).toBe('passed')
      expect(k1({ totalKg: limit * 100, ...split(below) }).status).toBe('finding')
      expect(k1({ totalKg: limit * 100 - 10, ...split(below) }).status).toBe('passed')
      expect(k1({ totalKg: limit * 100 - 10, ...split(from) }).status).toBe('finding')
    })
  }

  it('starts at tier 1 with no landlord share at 0 kg', () => {
    expect(k1({ totalKg: 0, ...split(0) }).status).toBe('passed')
  })

  it('gives the tenant 5% in the top tier', () => {
    expect(k1({ totalKg: 9_000, statedSplit: { landlordPct: 95, tenantPct: 5 } }).status).toBe('passed')
    expect(k1({ totalKg: 9_000, statedSplit: { landlordPct: 95, tenantPct: 0 } }).status).toBe('finding')
  })

  it('rounds to one decimal before the tier lookup', () => {
    // 11.96 rounds to 12.0, tier 2; 11.94 rounds to 11.9, tier 1.
    expect(k1({ totalKg: 1_196, ...split(10) }).status).toBe('passed')
    expect(k1({ totalKg: 1_194, ...split(0) }).status).toBe('passed')
    // 11.95 rounds half up to 12.0.
    expect(k1({ totalKg: 1_195, ...split(10) }).status).toBe('passed')
  })

  it('divides by the Building Profile’s living area, not the statement’s total area', () => {
    // 2,840 kg on 200 m² is 14.2 kg/m²/year, tier 2, whatever the statement prints as its area.
    expect(k1({ totalKg: 2_840, ...split(10) }, { livingAreaM2: 200 }).status).toBe('passed')
  })

  it('scales the tier limits down for a Billing Period shorter than 12 months', () => {
    // 181 of 365 days: tier 2 starts at 12 × 181/365 ≈ 5.95 kg. The 6.0 kg measured are not scaled up.
    const halfYear = { billingPeriod: { start: '2025-01-01', end: '2025-06-30' } }
    expect(k1({ totalKg: 600, ...split(10) }, halfYear).status).toBe('passed')
    expect(k1({ totalKg: 590, ...split(0) }, halfYear).status).toBe('passed')
    // A full year keeps the limits: 6.0 kg is tier 1.
    expect(k1({ totalKg: 600, ...split(0) }).status).toBe('passed')
  })

  it('counts a Billing Period across 29 Feb as a full year', () => {
    expect(k1({ totalKg: 1_200, ...split(10) }, { billingPeriod: { start: '2024-01-01', end: '2024-12-31' } }).status)
      .toBe('passed')
  })

  it('is Not assessable for a Billing Period starting before 1 Jan 2023 (§11 Abs. 2)', () => {
    expect(k1({}, { billingPeriod: { start: '2022-12-31', end: '2023-12-30' } })).toEqual({
      rule: 'K1',
      status: 'not_assessable',
      reason: expect.stringMatching(/01\.01\.2023.*§11 Abs\. 2 CO2KostAufG/),
    })
  })

  it('assesses a Billing Period starting on 1 Jan 2023', () => {
    expect(k1({ totalKg: 2_840, ...split(40) }, { billingPeriod: { start: '2023-01-01', end: '2023-12-31' } }).status)
      .toBe('passed')
  })

  it('is Not assessable for a Billing Period starting on or after 1 Jan 2028 (2026 amendment)', () => {
    expect(k1({}, { billingPeriod: { start: '2028-01-01', end: '2028-12-31' } })).toEqual({
      rule: 'K1',
      status: 'not_assessable',
      reason: expect.stringContaining('01.01.2028'),
    })
  })

  it('is Not assessable without the Billing Period or the living area', () => {
    expect(k1({}, { billingPeriod: null })).toEqual({
      rule: 'K1',
      status: 'not_assessable',
      reason: expect.stringContaining('Abrechnungszeitraum'),
    })
    expect(k1({}, { livingAreaM2: null })).toEqual({
      rule: 'K1',
      status: 'not_assessable',
      reason: expect.stringContaining('Wohnfläche'),
    })
  })

  // 3% of the Unit amounts of €1,000, €1,200 and €800.
  const cut = {
    severity: 'warning',
    legalReference: '§7 Abs. 3, 4 CO2KostAufG',
    message: expect.stringMatching(/3 %/),
    affectedUnits: [],
    amountAtStakeCents: 9_000,
  }

  it('warns that the Tenant may cut by 3% when the statement doesn’t show the split', () => {
    expect(k1({ statedSplit: null })).toEqual({
      rule: 'K1',
      status: 'finding',
      findings: [{ ...cut, message: expect.stringMatching(/Aufteilung.*3 %/) }],
    })
  })

  it('warns when the statement doesn’t show the tier, even if the split is right', () => {
    expect(k1({ totalKg: 2_840, ...split(40), statedTier: null })).toEqual({
      rule: 'K1',
      status: 'finding',
      findings: [{ ...cut, message: expect.stringMatching(/Stufe.*3 %/) }],
    })
  })

  it('warns when the statement doesn’t show how the tier was worked out', () => {
    const r = k1({ totalKg: 2_840, ...split(40), statedKgPerM2Year: null })
    expect(r.status === 'finding' && r.findings).toEqual([cut])
    const noTotal = k1({ totalKg: null })
    expect(noTotal.status === 'finding' && noTotal.findings).toEqual([cut])
  })

  it('lists the split Error before the 3% Warning', () => {
    const r = k1({ totalKg: 2_840, ...split(30), statedTier: null })
    expect(r.status === 'finding' && r.findings.map((f) => f.severity)).toEqual(['error', 'warning'])
  })

  it('has no amount at stake for the split Error without the CO₂ cost', () => {
    const r = k1({ totalKg: 2_840, ...split(30), costCents: null })
    expect(r.status === 'finding' && r.findings[0].amountAtStakeCents).toBeNull()
  })

  describe('§9 reductions', () => {
    // 2,840 kg on 100 m² is 28.4 kg/m²/year, tier 5: Property Manager 40%, Tenants 60%.
    const tier5 = { totalKg: 2_840, statedTier: 5, costCents: 25_000 }

    it('halves the Property Manager’s share for a heritage-protected building', () => {
      const heritage = { co2Reduction: 'heritage' } as const
      expect(k1({ ...tier5, ...split(20), statedReduction: 'halved' }, heritage).status).toBe('passed')
      // Tier 10: 95% halved is 47.5%.
      expect(
        k1({ totalKg: 9_000, ...split(47.5), statedTier: 10, statedReduction: 'halved' }, heritage).status,
      ).toBe('passed')
    })

    it('expects no split when the building must use district heating', () => {
      expect(
        k1({ ...tier5, ...split(0), statedReduction: 'no_split' }, { co2Reduction: 'district_heating' }).status,
      ).toBe('passed')
    })

    it('raises the split Error when the statement doesn’t apply the recorded reduction', () => {
      expect(k1({ ...tier5, ...split(40), statedReduction: 'none' }, { co2Reduction: 'heritage' })).toEqual({
        rule: 'K1',
        status: 'finding',
        findings: [
          {
            severity: 'error',
            legalReference: '§5 Abs. 1, §9 CO2KostAufG',
            message: expect.stringMatching(/Stufe 5.*§9.*halbiert.*20 %.*80 %.*40 %.*60 %/),
            affectedUnits: [],
            amountAtStakeCents: 5_000,
          },
        ],
      })
      const r = k1({ ...tier5, ...split(40) }, { co2Reduction: 'district_heating' })
      expect(r.status === 'finding' && r.findings).toEqual([
        expect.objectContaining({
          severity: 'error',
          message: expect.stringMatching(/§9.*Fernwärme/),
          amountAtStakeCents: 10_000,
        }),
      ])
    })

    it('warns when the statement claims a reduction the Building Profile doesn’t record', () => {
      const warning = {
        severity: 'warning',
        legalReference: '§9 CO2KostAufG',
        message: expect.stringMatching(/§9.*Gebäudeprofil/),
        affectedUnits: [],
        amountAtStakeCents: null,
      }
      // Halved without a recorded reduction: the split is wrong as well.
      const halved = k1({ ...tier5, ...split(20), statedReduction: 'halved' })
      expect(halved.status === 'finding' && halved.findings).toEqual([
        expect.objectContaining({ severity: 'error', amountAtStakeCents: 5_000 }),
        warning,
      ])
      // The wrong reduction: the profile records heritage protection, the statement claims no split.
      const wrongKind = k1({ ...tier5, ...split(20), statedReduction: 'no_split' }, { co2Reduction: 'heritage' })
      expect(wrongKind.status === 'finding' && wrongKind.findings).toEqual([
        { ...warning, message: expect.stringMatching(/keine Aufteilung.*Gebäudeprofil verzeichnet Denkmalschutz/) },
      ])
      // Unknown in the Building Profile counts as not recorded.
      const unknown = k1({ ...tier5, ...split(40), statedReduction: 'no_split' }, { co2Reduction: null })
      expect(unknown.status === 'finding' && unknown.findings).toEqual([
        { ...warning, message: expect.stringMatching(/Gebäudeprofil gibt nicht an.*ergänzen/) },
      ])
    })

    it('doesn’t warn when the statement claims no reduction', () => {
      expect(k1({ ...tier5, ...split(40), statedReduction: 'none' }).status).toBe('passed')
      expect(k1({ ...tier5, ...split(40), statedReduction: null }).status).toBe('passed')
    })
  })

  describe('the statement’s own kg/m²/year and tier (§5 Abs. 1)', () => {
    const right = { totalKg: 2_840, statedKgPerM2Year: 28.4, statedTier: 5, ...split(40), costCents: 25_000 }

    it('raises an Error when the stated kg/m²/year is wrong, even if the split is right', () => {
      expect(k1({ ...right, statedKgPerM2Year: 29 })).toEqual({
        rule: 'K1',
        status: 'finding',
        findings: [
          {
            severity: 'error',
            legalReference: '§5 Abs. 1 CO2KostAufG',
            message: expect.stringMatching(/29,0 kg.*28,4 kg.*Stufe 5/),
            affectedUnits: [],
            amountAtStakeCents: null,
          },
        ],
      })
    })

    it('raises an Error when the stated tier is wrong, even if the split is right', () => {
      const r = k1({ ...right, statedTier: 6 })
      expect(r.status === 'finding' && r.findings).toEqual([
        expect.objectContaining({ severity: 'error', message: expect.stringMatching(/Stufe 6.*Stufe 5/) }),
      ])
    })

    it('compares the stated kg/m²/year rounded to one decimal', () => {
      expect(k1({ ...right, statedKgPerM2Year: 28.43 }).status).toBe('passed')
      expect(k1({ ...right, statedKgPerM2Year: 28.35 }).status).toBe('passed')
      expect(k1({ ...right, statedKgPerM2Year: 28.45 }).status).toBe('finding')
    })

    it('expects the tier of the scaled-down limits for a short Billing Period', () => {
      // 6.0 kg in 181 of 365 days is tier 2 (see above), not tier 1.
      const halfYear = { billingPeriod: { start: '2025-01-01', end: '2025-06-30' } }
      expect(k1({ totalKg: 600, statedKgPerM2Year: 6, statedTier: 2, ...split(10) }, halfYear).status).toBe('passed')
      expect(k1({ totalKg: 600, statedKgPerM2Year: 6, statedTier: 1, ...split(10) }, halfYear).status).toBe('finding')
    })

    it('lists the split Error before the figures Error', () => {
      const r = k1({ ...right, statedTier: 6, ...split(30) })
      expect(r.status === 'finding' && r.findings.map((f) => [f.severity, f.amountAtStakeCents])).toEqual([
        ['error', 2_500],
        ['error', null],
      ])
    })

    it('checks the stated tier even when the statement doesn’t show the split', () => {
      const r = k1({ ...right, statedSplit: null, statedTier: 6 })
      expect(r.status === 'finding' && r.findings.map((f) => f.severity)).toEqual(['error', 'warning'])
    })
  })

  it('leaves a statement with no CO₂ data at all to K2', () => {
    expect(k1({ totalKg: null, statedSplit: null })).toEqual({
      rule: 'K1',
      status: 'not_assessable',
      reason: expect.stringContaining('K2'),
    })
  })
})

describe('K2: the statement has CO₂ data', () => {
  const k2 = (co2: Partial<Figures['building']['co2']>, billingPeriod = figures.building.billingPeriod) =>
    result(input({ billingPeriod, co2: { ...figures.building.co2, ...co2 } }), 'K2')

  it('passes when the statement gives the total CO₂ or the split', () => {
    expect(k2({})).toEqual({ rule: 'K2', status: 'passed' })
    expect(k2({ totalKg: null }).status).toBe('passed')
    expect(k2({ statedSplit: null }).status).toBe('passed')
  })

  it('warns that the Tenant may cut by 3% when both the total CO₂ and the split are missing', () => {
    expect(k2({ totalKg: null, statedSplit: null })).toEqual({
      rule: 'K2',
      status: 'finding',
      findings: [
        {
          severity: 'warning',
          legalReference: '§7 Abs. 3, 4 CO2KostAufG',
          message: expect.stringMatching(/keine CO₂-Angaben.*3 %/),
          affectedUnits: [],
          amountAtStakeCents: 9_000,
        },
      ],
    })
  })

  it('has no amount at stake when a Unit amount is missing', () => {
    const units = figures.units.map((u) => (u.unitId === 'WE 01' ? { ...u, amountCents: null } : u))
    const r = result(input({ co2: { ...figures.building.co2, totalKg: null, statedSplit: null } }, units), 'K2')
    expect(r.status === 'finding' && r.findings[0].amountAtStakeCents).toBeNull()
  })

  it('is Not assessable outside the CO2KostAufG’s time window', () => {
    expect(k2({ totalKg: null, statedSplit: null }, { start: '2022-01-01', end: '2022-12-31' }).status)
      .toBe('not_assessable')
    expect(k2({ totalKg: null, statedSplit: null }, { start: '2028-01-01', end: '2028-12-31' }).status)
      .toBe('not_assessable')
  })
})
