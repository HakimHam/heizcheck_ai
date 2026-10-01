// The true facts about a building that the Metering Provider doesn't supply.
// null means unknown, which the rules report as Not assessable.
export type BuildingProfile = {
  livingAreaM2: number | null
  heatedAreaM2: number | null
  /** §7 para 1 sentence 2 HeizkostenV: exactly 70% consumption share. */
  mandatory70Pct: boolean | null
  residential: boolean
  /** §9 CO2KostAufG reduction of the Property Manager's CO₂ share. */
  co2Reduction: Co2Reduction | null
}

export const CO2_REDUCTIONS = ['none', 'heritage', 'district_heating'] as const
export type Co2Reduction = (typeof CO2_REDUCTIONS)[number]

export type Address = { street: string; postalCode: string; city: string }

export type BuildingInput = { address: Address; profile: BuildingProfile }

// Residential is always known: the form requires it.
const FACTS: [keyof BuildingProfile, string][] = [
  ['livingAreaM2', 'Wohnfläche'],
  ['heatedAreaM2', 'Beheizte Fläche'],
  ['mandatory70Pct', '70-%-Pflicht (§7 HeizkostenV)'],
  ['co2Reduction', 'CO₂-Einschränkung (§9 CO2KostAufG)'],
]

/**
 * The German names of the facts still unknown. Missing areas make rules Not
 * assessable; a missing flag makes them assume less and warn instead.
 */
export function unknownFacts(profile: BuildingProfile): string[] {
  return FACTS.filter(([fact]) => profile[fact] === null).map(([, label]) => label)
}
