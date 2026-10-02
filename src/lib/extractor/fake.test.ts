import { describe, expect, it } from 'vitest'
import type { Figures } from '../figures'
import { createFakeExtractor, ExtractionFailed } from '.'

const pdfs = [
  { fileName: 'Gesamtabrechnung.pdf', bytes: new Uint8Array() },
  { fileName: 'Einzelabrechnungen.pdf', bytes: new Uint8Array() },
]

// Every leaf path of the figures that holds a value, e.g. "units.0.amountCents".
const figurePaths = (value: unknown, prefix = ''): string[] =>
  value === null
    ? []
    : typeof value === 'object'
      ? Object.entries(value as object).flatMap(([key, child]) =>
          figurePaths(child, prefix ? `${prefix}.${key}` : key),
        )
      : [prefix]

describe('the fake Extractor', () => {
  it('reads a package into the full Figures schema', async () => {
    const { figures } = await createFakeExtractor().extract(pdfs)
    expect(Object.keys(figures.building).sort()).toEqual([
      'allocationMethod',
      'areaDecimals',
      'billingPeriod',
      'co2',
      'costItems',
      'fuel',
      'heatingConsumptionSharePct',
      'hotWaterConsumptionSharePct',
      'totalAreaM2',
      'totalCostCents',
    ])
    expect(Object.keys(figures.building.co2).sort()).toEqual([
      'costCents',
      'statedKgPerM2Year',
      'statedReduction',
      'statedSplit',
      'statedTier',
      'totalKg',
    ])
    expect(figures.units.length).toBeGreaterThan(0)
  })

  it('says where in the uploaded PDFs every figure it found appears', async () => {
    const { figures, sources } = await createFakeExtractor().extract(pdfs)
    const fileNames = pdfs.map((pdf) => pdf.fileName)
    // A source belongs to a figure, or to a group of figures read together
    // (a Billing Period, a split, a Cost Item).
    for (const path of figurePaths(figures)) {
      const source = Object.entries(sources).find(([key]) => path === key || path.startsWith(`${key}.`))
      expect(source, path).toBeDefined()
      expect(fileNames).toContain(source?.[1].file)
    }
  })

  it('returns the figures it was given, so flows can be tested with known data', async () => {
    const figures = { building: { costItems: [] }, units: [] } as unknown as Figures
    const extractor = createFakeExtractor({ figures, sources: {} })
    expect(await extractor.extract(pdfs)).toEqual({ figures, sources: {} })
  })

  it('can fail the way a real extraction does', async () => {
    await expect(createFakeExtractor('fail').extract(pdfs)).rejects.toBeInstanceOf(ExtractionFailed)
  })
})
