import type { ExtractedFigures, Figures, SourceReference, UnitFigures } from '../figures'
import { ExtractionFailed, type Extractor, type StatementPdf } from './types'

const PERIOD = { start: '2025-01-01', end: '2025-12-31' }

// A plausible Minol package for six Units whose amounts add up to the total.
const UNITS: [string, number, number, number][] = [
  // unitId, area m², consumption, amount in cents
  ['WE 01', 68.4, 7_412, 151_238],
  ['WE 02', 74.2, 8_103, 165_042],
  ['WE 03', 52.9, 5_870, 118_655],
  ['WE 04', 68.4, 6_995, 144_210],
  ['WE 05', 74.2, 8_640, 173_517],
  ['WE 06', 92.7, 9_310, 197_338],
]

const DEMO_FIGURES: Figures = {
  building: {
    billingPeriod: PERIOD,
    costItems: [
      { name: 'Brennstoffkosten Erdgas', amountCents: 842_310 },
      { name: 'Betriebsstrom', amountCents: 18_450 },
      { name: 'Wartung', amountCents: 32_900 },
      { name: 'Immissionsmessung', amountCents: 6_840 },
      { name: 'Verbrauchsabrechnung Minol', amountCents: 49_500 },
    ],
    totalCostCents: 950_000,
    heatingConsumptionSharePct: 70,
    hotWaterConsumptionSharePct: 70,
    allocationMethod: 'consumption_split',
    totalAreaM2: 430.8,
    areaDecimals: 1,
    fuel: { type: 'Erdgas', quantity: 98_400, unit: 'kWh' },
    co2: {
      totalKg: 19_876,
      statedKgPerM2Year: 46.1,
      statedTier: 8,
      statedSplit: { landlordPct: 70, tenantPct: 30 },
      costCents: 99_380,
      statedReduction: 'none',
    },
  },
  units: UNITS.map(
    ([unitId, areaM2, consumption, amountCents]): UnitFigures => ({
      unitId,
      billingPeriod: PERIOD,
      areaM2,
      consumption,
      amountCents,
      estimated: false,
    }),
  ),
}

const at = (file: string, page: number, row: number): SourceReference => ({
  file,
  page,
  bbox: [0.08, Math.min(0.1 + row * 0.04, 0.9), 0.84, 0.03],
})

/**
 * The demo figures with a source for every figure: the Building Statement on
 * the first PDF, one Unit Statement per page of the last.
 */
function demo(pdfs: StatementPdf[]): ExtractedFigures {
  const buildingFile = pdfs[0]?.fileName ?? 'Gesamtabrechnung.pdf'
  const unitFile = pdfs.at(-1)?.fileName ?? buildingFile
  const sources: Record<string, SourceReference> = {}

  const { costItems, co2, ...building } = DEMO_FIGURES.building
  let row = 0
  for (const key of Object.keys(building)) sources[`building.${key}`] = at(buildingFile, 1, row++)
  costItems.forEach((_, i) => (sources[`building.costItems.${i}`] = at(buildingFile, 1, row++)))
  for (const key of Object.keys(co2)) sources[`building.co2.${key}`] = at(buildingFile, 2, row++)

  DEMO_FIGURES.units.forEach((unit, i) => {
    Object.keys(unit).forEach((key, r) => (sources[`units.${i}.${key}`] = at(unitFile, i + 1, r)))
  })

  return { figures: structuredClone(DEMO_FIGURES), sources }
}

/**
 * An in-memory Extractor. Without arguments it reads every package as the
 * same demo package; given Extracted Figures it returns those; given 'fail'
 * every extraction fails.
 */
export function createFakeExtractor(result?: ExtractedFigures | 'fail'): Extractor {
  return {
    async extract(pdfs) {
      if (result === 'fail') throw new ExtractionFailed('The fake Extractor was told to fail.')
      return result ? structuredClone(result) : demo(pdfs)
    },
  }
}
