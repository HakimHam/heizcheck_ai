import { CO2_REDUCTIONS, type BuildingInput, type Co2Reduction } from './building-profile'
import { isValidGermanPostalCode } from './postal-code'

export type BuildingField =
  | 'street'
  | 'postalCode'
  | 'city'
  | 'residential'
  | 'livingArea'
  | 'heatedArea'

export type BuildingFormErrors = Partial<Record<BuildingField, string>>

/** What a building form's Server Action returns to the form. */
export type BuildingFormState = {
  errors?: BuildingFormErrors
  /** What was submitted, so the form keeps it after a failed save. */
  values?: Record<string, string>
  error?: string
  saved?: boolean
}

export type BuildingFormResult =
  | { ok: true; building: BuildingInput }
  | { ok: false; errors: BuildingFormErrors }

const AREA_ERROR =
  'Bitte geben Sie eine Fläche größer als 0 m² mit höchstens zwei Nachkommastellen an.'

// German notation: optional dots between groups of three digits, comma before
// at most two decimals ("1.790,5", "812", "812,45").
const GERMAN_AREA = /^(\d{1,3}(\.\d{3})+|\d+)(,\d{1,2})?$/

const text = (form: FormData, name: string) => String(form.get(name) ?? '').trim()

/** A German-formatted area; blank means unknown, undefined means invalid. */
function parseArea(raw: string): number | null | undefined {
  if (!raw) return null
  if (!GERMAN_AREA.test(raw)) return undefined
  const value = Number(raw.replace(/\./g, '').replace(',', '.'))
  return value > 0 ? value : undefined
}

/** "ja" / "nein"; anything else means unknown. */
function yesNo(raw: string): boolean | null {
  return raw === 'ja' ? true : raw === 'nein' ? false : null
}

const co2Reduction = (raw: string): Co2Reduction | null =>
  CO2_REDUCTIONS.find((reduction) => reduction === raw) ?? null

/** Reads the create / edit building form. Blank facts stay unknown. */
export function parseBuildingForm(form: FormData): BuildingFormResult {
  const address = {
    street: text(form, 'street'),
    postalCode: text(form, 'postalCode'),
    city: text(form, 'city'),
  }
  const livingAreaM2 = parseArea(text(form, 'livingArea'))
  const heatedAreaM2 = parseArea(text(form, 'heatedArea'))
  const residential = yesNo(text(form, 'residential'))

  const errors: BuildingFormErrors = {}
  if (!address.street) errors.street = 'Bitte geben Sie Straße und Hausnummer an.'
  if (!isValidGermanPostalCode(address.postalCode)) {
    errors.postalCode = 'Bitte geben Sie eine fünfstellige Postleitzahl an.'
  }
  if (!address.city) errors.city = 'Bitte geben Sie den Ort an.'
  if (residential === null) {
    errors.residential = 'Bitte geben Sie an, ob es sich um ein Wohngebäude handelt.'
  }
  if (livingAreaM2 === undefined) errors.livingArea = AREA_ERROR
  if (heatedAreaM2 === undefined) errors.heatedArea = AREA_ERROR

  if (
    Object.keys(errors).length > 0 ||
    residential === null ||
    livingAreaM2 === undefined ||
    heatedAreaM2 === undefined
  ) {
    return { ok: false, errors }
  }

  return {
    ok: true,
    building: {
      address,
      profile: {
        livingAreaM2,
        heatedAreaM2,
        mandatory70Pct: yesNo(text(form, 'mandatory70Pct')),
        residential,
        co2Reduction: co2Reduction(text(form, 'co2Reduction')),
      },
    },
  }
}

export type BuildingFormValues = Record<
  BuildingField | 'mandatory70Pct' | 'co2Reduction',
  string
>

const areaValue = (m2: number | null) =>
  m2 === null ? '' : m2.toLocaleString('de-DE', { maximumFractionDigits: 2, useGrouping: false })

const yesNoValue = (value: boolean | null) => (value === null ? '' : value ? 'ja' : 'nein')

/** The form fields that `parseBuildingForm` reads back as `building`. */
export function buildingFormValues({ address, profile }: BuildingInput): BuildingFormValues {
  return {
    street: address.street,
    postalCode: address.postalCode,
    city: address.city,
    residential: yesNoValue(profile.residential),
    livingArea: areaValue(profile.livingAreaM2),
    heatedArea: areaValue(profile.heatedAreaM2),
    mandatory70Pct: yesNoValue(profile.mandatory70Pct),
    co2Reduction: profile.co2Reduction ?? '',
  }
}
