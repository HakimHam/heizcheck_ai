/** §9 CO2KostAufG: heritage protection halves the landlord share, required district heating removes the split. */
export const CO2_REDUCTIONS = ["none", "heritage", "district_heating"] as const;
export type Co2Reduction = (typeof CO2_REDUCTIONS)[number];

/**
 * Facts about a building that the Metering Provider doesn't supply. These are
 * the true values the rules compare a statement's claims against. `null`
 * means unknown: rules that need it report Not assessable.
 */
export type BuildingProfile = {
  livingAreaM2: number | null;
  heatedAreaM2: number | null;
  /** §7 Abs. 1 Satz 2 HeizkostenV: an exactly 70% consumption share is mandatory. */
  mandatory70Pct: boolean | null;
  /** Non-residential buildings are out of scope and refused at upload. */
  residential: boolean;
  co2Reduction: Co2Reduction | null;
};

/** The `buildings` columns that hold the Building Profile. */
export type BuildingProfileRow = {
  living_area_m2: number | null;
  heated_area_m2: number | null;
  mandatory_70_pct: boolean | null;
  residential: boolean;
  co2_reduction: Co2Reduction | null;
};

/** A building as read for its screens: address plus Building Profile. */
export type BuildingRow = BuildingProfileRow & { id: string; address: string };

export const BUILDING_COLUMNS = "id, address, living_area_m2, heated_area_m2, mandatory_70_pct, residential, co2_reduction";

export const profileFromRow = (row: BuildingProfileRow): BuildingProfile => ({
  livingAreaM2: row.living_area_m2 === null ? null : Number(row.living_area_m2),
  heatedAreaM2: row.heated_area_m2 === null ? null : Number(row.heated_area_m2),
  mandatory70Pct: row.mandatory_70_pct,
  residential: row.residential,
  co2Reduction: row.co2_reduction,
});

export const profileToRow = (profile: BuildingProfile): BuildingProfileRow => ({
  living_area_m2: profile.livingAreaM2,
  heated_area_m2: profile.heatedAreaM2,
  mandatory_70_pct: profile.mandatory70Pct,
  residential: profile.residential,
  co2_reduction: profile.co2Reduction,
});

/** The Building Profile facts still unknown, named as the form names them. */
export function unknownFacts(profile: BuildingProfile): string[] {
  return [
    profile.livingAreaM2 === null && "Wohnfläche",
    profile.heatedAreaM2 === null && "Beheizte Fläche",
    profile.mandatory70Pct === null && "70-%-Pflicht",
    profile.co2Reduction === null && "Minderung nach § 9 CO2KostAufG",
  ].filter((fact): fact is string => fact !== false);
}
