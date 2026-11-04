import {
  ALLOCATION_METHODS,
  AREA_DECIMALS,
  type BillingPeriod,
  type CostItem,
  type Figures,
  STATED_REDUCTIONS,
  type UnitFigures,
} from './figures'
import { isIsoDate } from './upload'

// The Confirm screen's form. Field names are figure paths, e.g.
// "building.totalCost" or "units.2.amount". A blank field is a figure not
// found (null); it is never filled with a default.

/** German messages keyed by field name (or the group, for a Billing Period or split). */
export type FiguresFormErrors = Record<string, string>

/** What the confirm Server Action returns to the form. */
export type FiguresFormState = {
  errors?: FiguresFormErrors
  /** What was submitted, so the form keeps it after a failed confirm. */
  values?: Record<string, string>
  error?: string
}

export type FiguresFormResult =
  | { ok: true; figures: Figures }
  | { ok: false; errors: FiguresFormErrors }

// German notation: optional dots between groups of three digits, a comma
// before the decimals.
const GERMAN_NUMBER = /^(-?)(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d+))?$/

const AMOUNT_ERROR = 'Bitte geben Sie einen Betrag in Euro mit höchstens zwei Nachkommastellen an.'
const PERCENT_ERROR = 'Bitte geben Sie einen Prozentsatz zwischen 0 und 100 an.'
const QUANTITY_ERROR = 'Bitte geben Sie eine Zahl von mindestens 0 an.'
const AREA_ERROR = 'Bitte geben Sie eine Fläche größer als 0 m² mit höchstens zwei Nachkommastellen an.'

/** Collects field errors while reading; `undefined` from a reader means invalid. */
class Reader {
  readonly errors: FiguresFormErrors = {}
  constructor(private readonly form: FormData) {}

  text(name: string) {
    return String(this.form.get(name) ?? '').trim()
  }

  fail(name: string, message: string): undefined {
    this.errors[name] ??= message
    return undefined
  }

  /** Euros in German notation, as integer cents. Exact: no float arithmetic. */
  cents(name: string): number | null | undefined {
    const raw = this.text(name).replace(/\s*€$/, '')
    if (!raw) return null
    const match = GERMAN_NUMBER.exec(raw)
    if (!match || (match[3] ?? '').length > 2) return this.fail(name, AMOUNT_ERROR)
    const [, sign, whole, fraction = ''] = match
    const cents = Number(whole.replace(/\./g, '')) * 100 + Number(fraction.padEnd(2, '0'))
    return sign ? -cents : cents
  }

  number(
    name: string,
    { maxDecimals, min, max, minExclusive = false }: NumberLimits,
    message: string,
  ): number | null | undefined {
    const raw = this.text(name)
    if (!raw) return null
    const match = GERMAN_NUMBER.exec(raw)
    if (!match || (match[3] ?? '').length > maxDecimals) return this.fail(name, message)
    const value = Number(raw.replace(/\./g, '').replace(',', '.'))
    if (value < min || (minExclusive && value === min) || value > max) return this.fail(name, message)
    return value
  }

  oneOf<T extends string | number>(name: string, options: readonly T[]): T | null {
    const raw = this.text(name)
    return options.find((option) => String(option) === raw) ?? null
  }

  yesNo(name: string): boolean | null {
    const raw = this.text(name)
    return raw === 'ja' ? true : raw === 'nein' ? false : null
  }

  billingPeriod(prefix: string): BillingPeriod | null | undefined {
    const start = this.text(`${prefix}.start`)
    const end = this.text(`${prefix}.end`)
    if (!start && !end) return null
    if (!isIsoDate(start) || !isIsoDate(end)) {
      return this.fail(prefix, 'Bitte geben Sie Beginn und Ende des Abrechnungszeitraums an.')
    }
    if (end < start) return this.fail(prefix, 'Das Ende liegt vor dem Beginn des Abrechnungszeitraums.')
    return { start, end }
  }

  /** The row indices present in the form for a list like "units". */
  indices(list: string): number[] {
    const pattern = new RegExp(`^${list.replace('.', '\\.')}\\.(\\d+)\\.`)
    const found = new Set<number>()
    for (const name of this.form.keys()) {
      const match = pattern.exec(name)
      if (match) found.add(Number(match[1]))
    }
    return [...found].sort((a, b) => a - b)
  }
}

type NumberLimits = { maxDecimals: number; min: number; max: number; minExclusive?: boolean }

const PERCENT: NumberLimits = { maxDecimals: 2, min: 0, max: 100 }
const AREA: NumberLimits = { maxDecimals: 2, min: 0, max: Infinity, minExclusive: true }
const QUANTITY: NumberLimits = { maxDecimals: 3, min: 0, max: Infinity }

function costItems(read: Reader): CostItem[] {
  return read.indices('building.costItems').flatMap((i) => {
    const prefix = `building.costItems.${i}`
    const name = read.text(`${prefix}.name`)
    const amountCents = read.cents(`${prefix}.amount`)
    if (!name && amountCents === null) return []
    if (!name) read.fail(`${prefix}.name`, 'Bitte geben Sie die Bezeichnung der Kostenposition an.')
    return [{ name, amountCents: amountCents ?? null }]
  })
}

function fuel(read: Reader): Figures['building']['fuel'] | undefined {
  const type = read.text('building.fuel.type')
  const quantity = read.number('building.fuel.quantity', QUANTITY, QUANTITY_ERROR)
  const unit = read.text('building.fuel.unit')
  if (!type && quantity === null && !unit) return null
  if (!type) return read.fail('building.fuel.type', 'Bitte geben Sie den Brennstoff an.')
  return quantity === undefined ? undefined : { type, quantity, unit }
}

function statedSplit(read: Reader): Figures['building']['co2']['statedSplit'] | undefined {
  const landlordPct = read.number('building.co2.statedLandlordPct', PERCENT, PERCENT_ERROR)
  const tenantPct = read.number('building.co2.statedTenantPct', PERCENT, PERCENT_ERROR)
  if (landlordPct === undefined || tenantPct === undefined) return undefined
  if (landlordPct === null && tenantPct === null) return null
  if (landlordPct === null || tenantPct === null) {
    return read.fail(
      'building.co2.statedSplit',
      'Bitte geben Sie beide Anteile der CO₂-Kostenaufteilung an oder lassen Sie beide leer.',
    )
  }
  return { landlordPct, tenantPct }
}

const UNIT_FIELDS = ['unitId', 'billingPeriod.start', 'billingPeriod.end', 'area', 'consumption', 'amount', 'estimated']

/** A Unit Statement row; an entirely empty row (e.g. the spare one) is no Unit. */
function unit(read: Reader, i: number): UnitFigures[] {
  const prefix = `units.${i}`
  if (UNIT_FIELDS.every((field) => !read.text(`${prefix}.${field}`))) return []
  const unitId = read.text(`${prefix}.unitId`)
  if (!unitId) read.fail(`${prefix}.unitId`, 'Bitte geben Sie die Nutzeinheit an.')
  return [{
    unitId,
    billingPeriod: read.billingPeriod(`${prefix}.billingPeriod`) ?? null,
    areaM2: read.number(`${prefix}.area`, AREA, AREA_ERROR) ?? null,
    consumption: read.number(`${prefix}.consumption`, QUANTITY, QUANTITY_ERROR) ?? null,
    amountCents: read.cents(`${prefix}.amount`) ?? null,
    estimated: read.yesNo(`${prefix}.estimated`),
  }]
}

/** Reads the Confirm screen into the figures to confirm. */
export function parseFiguresForm(form: FormData): FiguresFormResult {
  const read = new Reader(form)
  const figures: Figures = {
    building: {
      billingPeriod: read.billingPeriod('building.billingPeriod') ?? null,
      costItems: costItems(read),
      totalCostCents: read.cents('building.totalCost') ?? null,
      heatingConsumptionSharePct:
        read.number('building.heatingConsumptionSharePct', PERCENT, PERCENT_ERROR) ?? null,
      hotWaterConsumptionSharePct:
        read.number('building.hotWaterConsumptionSharePct', PERCENT, PERCENT_ERROR) ?? null,
      allocationMethod: read.oneOf('building.allocationMethod', ALLOCATION_METHODS),
      totalAreaM2: read.number('building.totalArea', AREA, AREA_ERROR) ?? null,
      areaDecimals: read.oneOf('building.areaDecimals', AREA_DECIMALS),
      fuel: fuel(read) ?? null,
      co2: {
        totalKg: read.number('building.co2.totalKg', QUANTITY, QUANTITY_ERROR) ?? null,
        statedKgPerM2Year:
          read.number('building.co2.statedKgPerM2Year', QUANTITY, QUANTITY_ERROR) ?? null,
        statedTier:
          read.number(
            'building.co2.statedTier',
            { maxDecimals: 0, min: 1, max: 10 },
            'Bitte geben Sie eine Stufe von 1 bis 10 an.',
          ) ?? null,
        statedSplit: statedSplit(read) ?? null,
        costCents: read.cents('building.co2.cost') ?? null,
        statedReduction: read.oneOf('building.co2.statedReduction', STATED_REDUCTIONS),
      },
    },
    units: read.indices('units').flatMap((i) => unit(read, i)),
  }
  return Object.keys(read.errors).length > 0
    ? { ok: false, errors: read.errors }
    : { ok: true, figures }
}

const decimal = (value: number | null, maxDecimals = 3) =>
  value === null
    ? ''
    : value.toLocaleString('de-DE', { maximumFractionDigits: maxDecimals, useGrouping: false })

const euros = (cents: number | null) =>
  cents === null
    ? ''
    : (cents / 100).toLocaleString('de-DE', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
        useGrouping: false,
      })

const yesNo = (value: boolean | null) => (value === null ? '' : value ? 'ja' : 'nein')

/** The form fields that `parseFiguresForm` reads back as `figures`. */
export function figuresFormValues({ building, units }: Figures): Record<string, string> {
  const values: Record<string, string> = {
    'building.billingPeriod.start': building.billingPeriod?.start ?? '',
    'building.billingPeriod.end': building.billingPeriod?.end ?? '',
    'building.totalCost': euros(building.totalCostCents),
    'building.heatingConsumptionSharePct': decimal(building.heatingConsumptionSharePct),
    'building.hotWaterConsumptionSharePct': decimal(building.hotWaterConsumptionSharePct),
    'building.allocationMethod': building.allocationMethod ?? '',
    'building.totalArea': decimal(building.totalAreaM2),
    'building.areaDecimals': building.areaDecimals === null ? '' : String(building.areaDecimals),
    'building.fuel.type': building.fuel?.type ?? '',
    'building.fuel.quantity': decimal(building.fuel?.quantity ?? null),
    'building.fuel.unit': building.fuel?.unit ?? '',
    'building.co2.totalKg': decimal(building.co2.totalKg),
    'building.co2.statedKgPerM2Year': decimal(building.co2.statedKgPerM2Year),
    'building.co2.statedTier': decimal(building.co2.statedTier),
    'building.co2.statedLandlordPct': decimal(building.co2.statedSplit?.landlordPct ?? null),
    'building.co2.statedTenantPct': decimal(building.co2.statedSplit?.tenantPct ?? null),
    'building.co2.cost': euros(building.co2.costCents),
    'building.co2.statedReduction': building.co2.statedReduction ?? '',
  }
  building.costItems.forEach((item, i) => {
    values[`building.costItems.${i}.name`] = item.name
    values[`building.costItems.${i}.amount`] = euros(item.amountCents)
  })
  units.forEach((unit, i) => {
    values[`units.${i}.unitId`] = unit.unitId
    values[`units.${i}.billingPeriod.start`] = unit.billingPeriod?.start ?? ''
    values[`units.${i}.billingPeriod.end`] = unit.billingPeriod?.end ?? ''
    values[`units.${i}.area`] = decimal(unit.areaM2)
    values[`units.${i}.consumption`] = decimal(unit.consumption)
    values[`units.${i}.amount`] = euros(unit.amountCents)
    values[`units.${i}.estimated`] = yesNo(unit.estimated)
  })
  return values
}
