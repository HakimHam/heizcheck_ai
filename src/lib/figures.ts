// The fixed schema shared by Extracted Figures and Confirmed Figures. Every
// figure is nullable: null means the statement doesn't show it, which the rules
// report as Not assessable. It is never replaced by a guess.

/** A calendar date, `YYYY-MM-DD`. Kept as text so figures stay plain JSON. */
export type IsoDate = string

export type BillingPeriod = { start: IsoDate; end: IsoDate }

export const ALLOCATION_METHODS = ['consumption_split', 'area_only'] as const
export type AllocationMethod = (typeof ALLOCATION_METHODS)[number]

export const AREA_DECIMALS = [0, 1, 2] as const
export type AreaDecimals = (typeof AREA_DECIMALS)[number]

export const STATED_REDUCTIONS = ['none', 'halved', 'no_split'] as const
/** A §9 CO2KostAufG reduction as the statement claims it. */
export type StatedReduction = (typeof STATED_REDUCTIONS)[number]

/** The CO₂ cost shares of the Property Manager (`landlordPct`) and the Tenants. */
export type Co2Split = { landlordPct: number; tenantPct: number }

export type CostItem = {
  /** Verbatim, as the Metering Provider wrote it. */
  name: string
  amountCents: number | null
}

export type BuildingFigures = {
  billingPeriod: BillingPeriod | null
  costItems: CostItem[]
  totalCostCents: number | null
  heatingConsumptionSharePct: number | null
  hotWaterConsumptionSharePct: number | null
  allocationMethod: AllocationMethod | null
  totalAreaM2: number | null
  /** How many decimals the statement prints areas with. */
  areaDecimals: AreaDecimals | null
  fuel: { type: string; quantity: number | null; unit: string } | null
  co2: {
    totalKg: number | null
    statedKgPerM2Year: number | null
    /** 1–10 */
    statedTier: number | null
    statedSplit: Co2Split | null
    costCents: number | null
    statedReduction: StatedReduction | null
  }
}

export type UnitFigures = {
  unitId: string
  billingPeriod: BillingPeriod | null
  areaM2: number | null
  consumption: number | null
  amountCents: number | null
  estimated: boolean | null
}

export type Figures = { building: BuildingFigures; units: UnitFigures[] }

/** Where a figure appears: a PDF of the package, a 1-based page and a region on it. */
export type SourceReference = {
  /** The PDF's file name as uploaded; the Confirm screen finds the PDF by it. */
  file: string
  page: number
  /** [x, y, width, height] as fractions of the page, from the top left. */
  bbox: [number, number, number, number]
}

/**
 * What the Extractor read. `sources` maps a figure's path in `figures`
 * (e.g. `building.totalCostCents`, `units.2.amountCents`) to where it appears.
 */
export type ExtractedFigures = { figures: Figures; sources: Record<string, SourceReference> }
