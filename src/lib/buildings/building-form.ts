import { CO2_REDUCTIONS, type BuildingProfile, type Co2Reduction } from "./building-profile";

export type BuildingInput = { address: string; profile: BuildingProfile };

export type BuildingFormField = "address" | "livingArea" | "heatedArea" | "mandatory70Pct" | "residential" | "co2Reduction";
export type BuildingFormErrors = Partial<Record<BuildingFormField, string>>;
export type BuildingFormValues = Record<BuildingFormField, string>;

export type ParsedBuildingForm = { ok: true; building: BuildingInput } | { ok: false; errors: BuildingFormErrors };

/** The largest area the database column (numeric(10, 2)) holds. */
const MAX_AREA_M2 = 99_999_999.99;

const AREA_ERROR = "Bitte eine Fläche in m² größer als 0 mit höchstens zwei Nachkommastellen angeben, z. B. 612,40.";

/**
 * Reads a building's address and Building Profile from the German form.
 * Blank or "unbekannt" answers stay unknown (`null`) rather than taking a default.
 */
export function parseBuildingForm(formData: FormData): ParsedBuildingForm {
  const value = (name: BuildingFormField) => String(formData.get(name) ?? "").trim();
  const errors: BuildingFormErrors = {};

  const address = value("address");
  if (!address) errors.address = "Bitte geben Sie die Adresse des Gebäudes ein.";

  const area = (name: "livingArea" | "heatedArea") => {
    const parsed = parseArea(value(name));
    if (parsed === undefined) errors[name] = AREA_ERROR;
    return parsed ?? null;
  };
  const livingAreaM2 = area("livingArea");
  const heatedAreaM2 = area("heatedArea");

  const mandatory70Pct = parseYesNo(value("mandatory70Pct"));
  if (mandatory70Pct === undefined) errors.mandatory70Pct = "Bitte wählen Sie Ja, Nein oder Unbekannt.";

  const residential = parseYesNo(value("residential"));
  if (residential === undefined || residential === null) {
    errors.residential = "Bitte geben Sie an, ob das Gebäude ein Wohngebäude ist.";
  }

  const co2Reduction = parseCo2Reduction(value("co2Reduction"));
  if (co2Reduction === undefined) errors.co2Reduction = "Bitte wählen Sie eine der angebotenen Angaben.";

  if (Object.keys(errors).length > 0) return { ok: false, errors };
  return {
    ok: true,
    building: {
      address,
      profile: {
        livingAreaM2,
        heatedAreaM2,
        mandatory70Pct: mandatory70Pct ?? null,
        residential: residential!,
        co2Reduction: co2Reduction ?? null,
      },
    },
  };
}

/** What the form shows for a building: blank for a new one, "" wherever a fact is unknown. */
export function toFormValues(building: BuildingInput | null): BuildingFormValues {
  const yesNo = (value: boolean | null | undefined) => (value === null || value === undefined ? "" : String(value));
  return {
    address: building?.address ?? "",
    livingArea: formatArea(building?.profile.livingAreaM2 ?? null),
    heatedArea: formatArea(building?.profile.heatedAreaM2 ?? null),
    mandatory70Pct: yesNo(building?.profile.mandatory70Pct),
    residential: yesNo(building?.profile.residential),
    co2Reduction: building?.profile.co2Reduction ?? "",
  };
}

/** An area as the form shows it: decimal comma, no thousands separator, blank if unknown. */
export function formatArea(areaM2: number | null): string {
  if (areaM2 === null) return "";
  return areaM2.toLocaleString("de-DE", { useGrouping: false, maximumFractionDigits: 2 });
}

/**
 * Accepts German ("1.234,56") and plain ("1234.56") notation. Blank is unknown
 * (`null`); anything unreadable, non-positive or finer than 0.01 m² is `undefined`.
 */
function parseArea(input: string): number | null | undefined {
  const compact = input.replace(/[\s ]/g, "");
  if (!compact) return null;

  let normalised: string;
  if (/^(\d{1,3}(\.\d{3})+|\d+)(,\d{1,2})?$/.test(compact)) {
    normalised = compact.replace(/\./g, "").replace(",", ".");
  } else if (/^\d+\.\d{1,2}$/.test(compact)) {
    normalised = compact;
  } else {
    return undefined;
  }

  const area = Number(normalised);
  return area > 0 && area <= MAX_AREA_M2 ? area : undefined;
}

function parseYesNo(input: string): boolean | null | undefined {
  if (input === "") return null;
  if (input === "true") return true;
  if (input === "false") return false;
  return undefined;
}

function parseCo2Reduction(input: string): Co2Reduction | null | undefined {
  if (input === "") return null;
  return (CO2_REDUCTIONS as readonly string[]).includes(input) ? (input as Co2Reduction) : undefined;
}
