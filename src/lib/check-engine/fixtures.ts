// Test fixtures for the check engine. The clean package is consistent for
// every rule in the catalogue; planted-error fixtures copy it and break one rule.
import type { BuildingProfile } from '../building-profile'
import type { Figures, UnitFigures } from '../figures'
import type { CheckInput, RuleId } from './types'

const unit = (unitId: string, amountCents: number): UnitFigures => ({
  unitId,
  billingPeriod: { start: '2025-01-01', end: '2025-12-31' },
  areaM2: 70.5,
  consumption: 1200,
  amountCents,
  estimated: false,
})

// Three Units whose amounts add up exactly to the building total and whose
// areas add up exactly to the heated area.
export const cleanFigures: Figures = {
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

export const cleanProfile: BuildingProfile = {
  livingAreaM2: 211.5,
  heatedAreaM2: 211.5,
  mandatory70Pct: true,
  residential: true,
  co2Reduction: 'none',
}

export const cleanPackage: CheckInput = {
  confirmedFigures: cleanFigures,
  buildingProfile: cleanProfile,
  dispatchDate: '2026-03-15',
}

const withBuildingFigures = (overrides: Partial<Figures['building']>): CheckInput => ({
  ...cleanPackage,
  confirmedFigures: { ...cleanFigures, building: { ...cleanFigures.building, ...overrides } },
})

const withUnits = (units: UnitFigures[]): CheckInput => ({
  ...cleanPackage,
  confirmedFigures: { ...cleanFigures, units },
})

/** A copy of the clean package for each rule, with one error only that rule should catch. */
export const plantedErrors = {
  // WE 02 billed €1.00 more than the building total allows.
  C1: withUnits(cleanFigures.units.map((u) => (u.unitId === 'WE 02' ? { ...u, amountCents: 120_100 } : u))),
  // WE 03 printed at 75.5 m²: the Units add up to 216.5 m², 5 m² over the heated area.
  C2: withUnits(cleanFigures.units.map((u) => (u.unitId === 'WE 03' ? { ...u, areaM2: 75.5 } : u))),
  // WE 01 billed for the previous year.
  C3: withUnits(
    cleanFigures.units.map((u) =>
      u.unitId === 'WE 01' ? { ...u, billingPeriod: { start: '2024-01-01', end: '2024-12-31' } } : u,
    ),
  ),
  // Heating split 60/40: lawful in general, but the Building Profile requires exactly 70%.
  H1: withBuildingFigures({ heatingConsumptionSharePct: 60 }),
  // Hot water split 45/55, below the 50% minimum.
  H2: withBuildingFigures({ hotWaterConsumptionSharePct: 45 }),
  // €412.50 of the total is a repair, which Tenants can't be charged for. The items still add up.
  H3: withBuildingFigures({
    costItems: [
      { name: 'Brennstoffkosten', amountCents: 258_750 },
      { name: 'Reparaturkosten', amountCents: 41_250 },
    ],
  }),
} satisfies Partial<Record<RuleId, CheckInput>>
