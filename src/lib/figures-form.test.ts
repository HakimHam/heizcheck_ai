import { describe, expect, it } from 'vitest'
import { createFakeExtractor } from './extractor'
import type { Figures } from './figures'
import { figuresFormValues, parseFiguresForm } from './figures-form'

const demo = async () => (await createFakeExtractor().extract([])).figures

const formOf = (values: Record<string, string>) => {
  const form = new FormData()
  for (const [name, value] of Object.entries(values)) form.set(name, value)
  return form
}

const parsed = (values: Record<string, string>): Figures => {
  const result = parseFiguresForm(formOf(values))
  if (!result.ok) throw new Error(JSON.stringify(result.errors))
  return result.figures
}

describe('parseFiguresForm', () => {
  it('reads back unchanged figures exactly as they were shown', async () => {
    const figures = await demo()
    expect(parsed(figuresFormValues(figures))).toEqual(figures)
  })

  it('reads corrected German amounts into integer cents', async () => {
    const values = figuresFormValues(await demo())
    const figures = parsed({
      ...values,
      'building.totalCost': '9.500,1',
      'units.0.amount': '1512,38 €',
      'units.1.amount': '1650',
    })
    expect(figures.building.totalCostCents).toBe(950_010)
    expect(figures.units[0].amountCents).toBe(151_238)
    expect(figures.units[1].amountCents).toBe(165_000)
  })

  it('keeps a figure left empty as not found, never a default', async () => {
    const values = figuresFormValues(await demo())
    const figures = parsed({
      ...values,
      'building.totalCost': '',
      'building.heatingConsumptionSharePct': '',
      'building.areaDecimals': '',
      'building.co2.statedLandlordPct': '',
      'building.co2.statedTenantPct': '',
      'building.billingPeriod.start': '',
      'building.billingPeriod.end': '',
      'units.2.estimated': '',
      'units.2.area': '',
    })
    expect(figures.building.totalCostCents).toBeNull()
    expect(figures.building.heatingConsumptionSharePct).toBeNull()
    expect(figures.building.areaDecimals).toBeNull()
    expect(figures.building.co2.statedSplit).toBeNull()
    expect(figures.building.billingPeriod).toBeNull()
    expect(figures.units[2].estimated).toBeNull()
    expect(figures.units[2].areaM2).toBeNull()
  })

  it('fills in a figure the Extractor left empty', async () => {
    const figures = await demo()
    figures.units[0].estimated = null
    figures.building.co2.statedTier = null
    const values = figuresFormValues(figures)
    const confirmed = parsed({ ...values, 'units.0.estimated': 'ja', 'building.co2.statedTier': '8' })
    expect(confirmed.units[0].estimated).toBe(true)
    expect(confirmed.building.co2.statedTier).toBe(8)
  })

  it('adds a Cost Item typed into an empty row and drops empty rows', async () => {
    const values = figuresFormValues(await demo())
    const figures = parsed({
      ...values,
      'building.costItems.5.name': 'Schornsteinfeger',
      'building.costItems.5.amount': '120,00',
      'building.costItems.6.name': '',
      'building.costItems.6.amount': '',
    })
    expect(figures.building.costItems.at(-1)).toEqual({ name: 'Schornsteinfeger', amountCents: 12_000 })
    expect(figures.building.costItems).toHaveLength(6)
  })

  it('adds a Unit typed into an empty row and drops empty rows', async () => {
    const values = figuresFormValues(await demo())
    const figures = parsed({
      ...values,
      'units.6.unitId': 'WE 07',
      'units.6.amount': '99,00',
      'units.6.estimated': 'nein',
      'units.7.unitId': '',
      'units.7.amount': '',
      'units.7.estimated': '',
    })
    expect(figures.units).toHaveLength(7)
    expect(figures.units[6]).toEqual({
      unitId: 'WE 07',
      billingPeriod: null,
      areaM2: null,
      consumption: null,
      amountCents: 9_900,
      estimated: false,
    })
  })

  it('names each figure it cannot read, in German', async () => {
    const values = figuresFormValues(await demo())
    const result = parseFiguresForm(
      formOf({
        ...values,
        'building.totalCost': '12.34.5',
        'building.heatingConsumptionSharePct': '170',
        'building.co2.statedTier': '11',
        'building.co2.statedLandlordPct': '70',
        'building.co2.statedTenantPct': '',
        'building.billingPeriod.end': '2024-12-31',
        'units.1.unitId': ' ',
        'building.costItems.0.name': '',
      }),
    )
    expect(result).toEqual({
      ok: false,
      errors: {
        'building.totalCost': expect.stringMatching(/Betrag/),
        'building.heatingConsumptionSharePct': expect.stringMatching(/0 und 100/),
        'building.co2.statedTier': expect.stringMatching(/1 bis 10/),
        'building.co2.statedSplit': expect.stringMatching(/beide/),
        'building.billingPeriod': expect.stringMatching(/Ende/),
        'units.1.unitId': expect.stringMatching(/Nutzeinheit/),
        'building.costItems.0.name': expect.stringMatching(/Bezeichnung/),
      },
    })
  })
})
