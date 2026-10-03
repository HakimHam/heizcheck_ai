import { describe, expect, it } from 'vitest'
import { createFakeExtractor } from './extractor'
import type { SourceReference } from './figures'
import { figuresFormValues } from './figures-form'
import { countNotFound, sourceOfField } from './figure-sources'

const at = (page: number): SourceReference => ({ file: 'a.pdf', page, bbox: [0.1, 0.2, 0.3, 0.04] })

describe('sourceOfField', () => {
  it('finds the source of a figure whose field has the same name', () => {
    const sources = { 'building.heatingConsumptionSharePct': at(1) }
    expect(sourceOfField('building.heatingConsumptionSharePct', sources)).toEqual(at(1))
  })

  it('maps fields that are entered in other units to their figure', () => {
    const sources = {
      'building.totalCostCents': at(1),
      'building.totalAreaM2': at(2),
      'building.co2.costCents': at(3),
      'units.2.amountCents': at(4),
      'units.2.areaM2': at(5),
      'building.costItems.1.amountCents': at(6),
    }
    expect(sourceOfField('building.totalCost', sources)).toEqual(at(1))
    expect(sourceOfField('building.totalArea', sources)).toEqual(at(2))
    expect(sourceOfField('building.co2.cost', sources)).toEqual(at(3))
    expect(sourceOfField('units.2.amount', sources)).toEqual(at(4))
    expect(sourceOfField('units.2.area', sources)).toEqual(at(5))
    expect(sourceOfField('building.costItems.1.amount', sources)).toEqual(at(6))
  })

  it('falls back to the figure a field is part of', () => {
    const sources = {
      'building.billingPeriod': at(1),
      'building.co2.statedSplit': at(2),
      'building.fuel': at(3),
      'building.costItems.0': at(4),
      'units.3': at(5),
    }
    expect(sourceOfField('building.billingPeriod.end', sources)).toEqual(at(1))
    expect(sourceOfField('building.co2.statedLandlordPct', sources)).toEqual(at(2))
    expect(sourceOfField('building.co2.statedTenantPct', sources)).toEqual(at(2))
    expect(sourceOfField('building.fuel.quantity', sources)).toEqual(at(3))
    expect(sourceOfField('building.costItems.0.name', sources)).toEqual(at(4))
    expect(sourceOfField('units.3.billingPeriod.start', sources)).toEqual(at(5))
  })

  it('prefers the most specific source', () => {
    const sources = { 'units.1': at(1), 'units.1.areaM2': at(2) }
    expect(sourceOfField('units.1.area', sources)).toEqual(at(2))
    expect(sourceOfField('units.1.consumption', sources)).toEqual(at(1))
  })

  it('never falls back to the whole statement or all Units', () => {
    const sources = { building: at(1), units: at(2) }
    expect(sourceOfField('building.totalCost', sources)).toBeNull()
    expect(sourceOfField('units.0.amount', sources)).toBeNull()
  })

  it('has no source for a figure the Extractor did not find', () => {
    expect(sourceOfField('building.co2.statedTier', {})).toBeNull()
    expect(sourceOfField('units.9.amount', {})).toBeNull()
  })

  it('finds a source for every field of the fake Extractor’s package', async () => {
    const { figures, sources } = await createFakeExtractor().extract([])
    for (const field of Object.keys(figuresFormValues(figures))) {
      expect(sourceOfField(field, sources), field).not.toBeNull()
    }
  })
})

describe('countNotFound', () => {
  it('is 0 when every figure was found', async () => {
    const { figures } = await createFakeExtractor().extract([])
    expect(countNotFound(figures)).toBe(0)
  })

  it('counts each figure once, even one entered in several fields', async () => {
    const { figures } = await createFakeExtractor().extract([])
    figures.building.billingPeriod = null
    figures.building.fuel = null
    figures.building.co2.statedSplit = null
    figures.building.co2.statedTier = null
    figures.building.costItems[1].amountCents = null
    figures.units[2].estimated = null
    figures.units[3].areaM2 = null
    expect(countNotFound(figures)).toBe(7)
  })

  it('counts a fuel quantity not found', async () => {
    const { figures } = await createFakeExtractor().extract([])
    figures.building.fuel = { type: 'Erdgas', quantity: null, unit: 'kWh' }
    expect(countNotFound(figures)).toBe(1)
  })
})
