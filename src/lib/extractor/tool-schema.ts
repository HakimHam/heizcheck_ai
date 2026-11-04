import { z } from 'zod'
import {
  ALLOCATION_METHODS,
  type AreaDecimals,
  type BuildingFigures,
  type Figures,
  STATED_REDUCTIONS,
  type UnitFigures,
} from '../figures'
import type { Quote } from './bbox'

// The tool the model reports the figures through, and the Zod contract its
// input must meet. The model lists only the figures it finds: one not listed
// is null. Each value is a string in a fixed format, parsed here. That keeps
// the strict tool's schema free of unions (Anthropic allows at most 16 across
// a request), and money exact.
//
// The schema only describes what a statement states. It has no verdict,
// severity or judgement field (ADR 0001).

export const TOOL_NAME = 'record_statement_figures'

// Value formats. Each parser takes the model's string and rejects anything else.
const euros = z
  .string()
  .regex(/^-?\d+(\.\d{1,2})?$/)
  .transform((value) => {
    const [whole, fraction = ''] = value.replace('-', '').split('.')
    const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'))
    return value.startsWith('-') ? -cents : cents
  })
const decimal = z.string().regex(/^-?\d+(\.\d+)?$/).transform(Number)
const whole = z.string().regex(/^-?\d+$/).transform(Number)
const text = z.string().refine((value) => value.trim() !== '')
const isoDate = z.iso.date()
const period = z
  .string()
  .transform((value) => value.split('/'))
  .pipe(z.tuple([isoDate, isoDate]))
  .transform(([start, end]) => ({ start, end }))
const flag = z.enum(['true', 'false']).transform((value) => value === 'true')

type Parser = z.ZodType<unknown, string>
type FigureSpec = { parse: Parser; format: string; description: string }

const EUROS = 'euros as a plain decimal with a dot and at most 2 decimals, e.g. "1234.56" for 1.234,56 €'
const NUMBER = 'a plain decimal with a dot, e.g. "68.4" for 68,4'
const PERIOD = 'start and end date as "YYYY-MM-DD/YYYY-MM-DD"'

const BUILDING_FIGURES = {
  billingPeriod: { parse: period, format: PERIOD, description: 'The Billing Period of the Building Statement.' },
  totalCost: { parse: euros, format: EUROS, description: 'The total heating costs of the building as printed.' },
  heatingConsumptionSharePct: {
    parse: decimal,
    format: NUMBER,
    description: 'The share of heating costs allocated by consumption, in percent (e.g. "70" for 70 % Verbrauch / 30 % Grundkosten).',
  },
  hotWaterConsumptionSharePct: {
    parse: decimal,
    format: NUMBER,
    description: 'The share of hot water costs allocated by consumption, in percent.',
  },
  allocationMethod: {
    parse: z.enum(ALLOCATION_METHODS),
    format: `one of ${ALLOCATION_METHODS.map((m) => `"${m}"`).join(', ')}`,
    description:
      'How costs are allocated: "consumption_split" when split into a consumption share and a base share (Grundkosten by area), "area_only" when allocated by area alone without consumption readings.',
  },
  totalAreaM2: { parse: decimal, format: NUMBER, description: 'The total area of the building in m² that costs are allocated over.' },
  areaDecimals: {
    parse: z.enum(['0', '1', '2']).transform((value) => Number(value) as AreaDecimals),
    format: '"0", "1" or "2"',
    description: 'How many decimals the statement prints areas with. Quote an area that shows it.',
  },
  fuelType: { parse: text, format: 'the fuel as printed', description: 'The fuel used, e.g. "Erdgas", "Heizöl", "Fernwärme".' },
  fuelQuantity: { parse: decimal, format: NUMBER, description: 'The quantity of fuel used, in the unit printed.' },
  fuelUnit: { parse: text, format: 'the unit as printed', description: 'The unit of the fuel quantity, e.g. "kWh", "l", "m³".' },
  co2TotalKg: { parse: decimal, format: NUMBER, description: 'The building\'s total CO₂ emissions in kg.' },
  co2KgPerM2Year: { parse: decimal, format: NUMBER, description: 'The CO₂ emissions in kg per m² of living area per year, as stated.' },
  co2Tier: { parse: whole, format: 'a whole number, e.g. "8"', description: 'The CO₂ tier (Stufe 1–10 of the CO2KostAufG table) as stated.' },
  co2LandlordSharePct: { parse: decimal, format: NUMBER, description: 'The landlord\'s (Vermieter) share of the CO₂ costs in percent, as stated.' },
  co2TenantSharePct: { parse: decimal, format: NUMBER, description: 'The tenants\' (Mieter) share of the CO₂ costs in percent, as stated.' },
  co2Cost: { parse: euros, format: EUROS, description: 'The CO₂ costs as stated.' },
  co2Reduction: {
    parse: z.enum(STATED_REDUCTIONS),
    format: `one of ${STATED_REDUCTIONS.map((r) => `"${r}"`).join(', ')}`,
    description:
      'A reduction of the landlord\'s CO₂ share the statement claims (§9 CO2KostAufG): "halved" when it states the share is halved, "no_split" when it states the CO₂ costs are not split, "none" when it states no reduction applies.',
  },
} satisfies Record<string, FigureSpec>

const UNIT_FIGURES = {
  billingPeriod: { parse: period, format: PERIOD, description: 'The Billing Period of the Unit Statement.' },
  areaM2: { parse: decimal, format: NUMBER, description: 'The Unit\'s area in m².' },
  consumption: { parse: decimal, format: NUMBER, description: 'The Unit\'s heating consumption (units or kWh) as printed.' },
  amount: { parse: euros, format: EUROS, description: 'The heating cost amount charged to the Unit.' },
  estimated: { parse: flag, format: '"true" or "false"', description: 'Whether the statement says the Unit\'s readings were estimated (geschätzt).' },
} satisfies Record<string, FigureSpec>

type BuildingFigure = keyof typeof BUILDING_FIGURES
type UnitFigure = keyof typeof UNIT_FIGURES

const list = (figures: Record<string, FigureSpec>) =>
  Object.entries(figures)
    .map(([name, { format, description }]) => `- ${name}: ${description} Value: ${format}.`)
    .join('\n')

export const TOOL_DESCRIPTION = `Records the figures of one heating cost Statement Package exactly as the statement states them.

List each figure you find once, with the PDF file, the 1-based page and the quote: the text exactly as printed where you read it (e.g. "9.500,00 €"). Leave out any figure the statement doesn't show. Never estimate, compute or correct a figure.

Building figures:
${list(BUILDING_FIGURES)}

Cost Items: every cost line of the Building Statement, with its name exactly as written and its amount (${EUROS}). Leave out the amount if none is printed.

Units: every Unit Statement, with the Unit's id exactly as printed (e.g. "WE 01" or the user number) and these figures:
${list(UNIT_FIGURES)}`

/** The JSON schema of the tool's input, for a package with these files. */
export function toolInputSchema(fileNames: string[]) {
  const location = {
    file: { type: 'string', enum: fileNames, description: 'The PDF\'s file name exactly as labelled.' },
    page: { type: 'integer', description: 'The 1-based page in that PDF.' },
    quote: { type: 'string', description: 'The text exactly as printed where the figure was read.' },
  }
  const object = (properties: Record<string, unknown>, required = Object.keys(properties)) => ({
    type: 'object',
    properties,
    required,
    additionalProperties: false,
  })
  const figures = (names: string[]) => ({
    type: 'array',
    items: object({ figure: { type: 'string', enum: names }, value: { type: 'string' }, ...location }),
  })
  return object({
    buildingFigures: figures(Object.keys(BUILDING_FIGURES)),
    costItems: {
      type: 'array',
      items: object(
        { name: { type: 'string' }, amount: { type: 'string' }, ...location },
        ['name', 'file', 'page', 'quote'],
      ),
    },
    units: {
      type: 'array',
      items: object({ unitId: { type: 'string' }, ...location, figures: figures(Object.keys(UNIT_FIGURES)) }),
    },
  })
}

/** The figures read, and for each figure path where it was read. */
export type ReadFigures = { figures: Figures; quotes: Record<string, Quote> }

/** The Zod contract for the tool's input; parsing it gives the figures read. */
export function toolInput(fileNames: string[]): z.ZodType<ReadFigures> {
  const location = {
    file: z.enum(fileNames as [string, ...string[]]),
    page: z.number().int().min(1),
    quote: text,
  }
  const entry = <Name extends string>(names: Name[]) =>
    z.strictObject({ figure: z.enum(names as [Name, ...Name[]]), value: z.string(), ...location })

  return z
    .strictObject({
      buildingFigures: z.array(entry(Object.keys(BUILDING_FIGURES) as BuildingFigure[])),
      costItems: z.array(z.strictObject({ name: text, amount: z.string().optional(), ...location })),
      units: z.array(
        z.strictObject({ unitId: text, ...location, figures: z.array(entry(Object.keys(UNIT_FIGURES) as UnitFigure[])) }),
      ),
    })
    .transform((input, ctx): ReadFigures => {
      const quotes: Record<string, Quote> = {}
      const quoteOf = ({ file, page, quote }: Quote) => ({ file, page, quote })

      /** The parsed figures by name; a figure listed twice or with a malformed value is an issue. */
      function read<Name extends string>(
        entries: { figure: Name; value: string; file: string; page: number; quote: string }[],
        specs: Record<Name, FigureSpec>,
        path: (string | number)[],
      ) {
        const values = new Map<Name, { value: unknown; quote: Quote }>()
        entries.forEach((e, i) => {
          if (values.has(e.figure)) {
            ctx.addIssue({ code: 'custom', message: `${e.figure} is listed twice`, path: [...path, i] })
            return
          }
          const parsed = specs[e.figure].parse.safeParse(e.value)
          if (!parsed.success) {
            ctx.addIssue({ code: 'custom', message: `${e.figure}: "${e.value}" is not ${specs[e.figure].format}`, path: [...path, i, 'value'] })
            return
          }
          values.set(e.figure, { value: parsed.data, quote: quoteOf(e) })
        })
        return values
      }

      const b = read(input.buildingFigures, BUILDING_FIGURES, ['buildingFigures'])
      const get = <T>(name: BuildingFigure, path?: string) => {
        const found = b.get(name)
        if (!found) return null
        if (path) quotes[`building.${path}`] = found.quote
        return found.value as T
      }

      const fuelType = get<string>('fuelType', 'fuel')
      const fuelQuantity = get<number>('fuelQuantity')
      const fuelUnit = get<string>('fuelUnit')
      if (fuelType === null) delete quotes['building.fuel']
      const landlordPct = get<number>('co2LandlordSharePct', 'co2.statedSplit')
      const tenantPct = get<number>('co2TenantSharePct')
      const statedSplit = landlordPct !== null && tenantPct !== null ? { landlordPct, tenantPct } : null
      if (!statedSplit) delete quotes['building.co2.statedSplit']

      const building: BuildingFigures = {
        billingPeriod: get('billingPeriod', 'billingPeriod'),
        costItems: input.costItems.map((item, i) => {
          quotes[`building.costItems.${i}`] = quoteOf(item)
          if (item.amount === undefined) return { name: item.name, amountCents: null }
          const amount = euros.safeParse(item.amount)
          if (!amount.success) {
            ctx.addIssue({ code: 'custom', message: `"${item.amount}" is not ${EUROS}`, path: ['costItems', i, 'amount'] })
          }
          return { name: item.name, amountCents: amount.data ?? null }
        }),
        totalCostCents: get('totalCost', 'totalCostCents'),
        heatingConsumptionSharePct: get('heatingConsumptionSharePct', 'heatingConsumptionSharePct'),
        hotWaterConsumptionSharePct: get('hotWaterConsumptionSharePct', 'hotWaterConsumptionSharePct'),
        allocationMethod: get('allocationMethod', 'allocationMethod'),
        totalAreaM2: get('totalAreaM2', 'totalAreaM2'),
        areaDecimals: get('areaDecimals', 'areaDecimals'),
        fuel: fuelType === null ? null : { type: fuelType, quantity: fuelQuantity, unit: fuelUnit ?? '' },
        co2: {
          totalKg: get('co2TotalKg', 'co2.totalKg'),
          statedKgPerM2Year: get('co2KgPerM2Year', 'co2.statedKgPerM2Year'),
          statedTier: get('co2Tier', 'co2.statedTier'),
          statedSplit,
          costCents: get('co2Cost', 'co2.costCents'),
          statedReduction: get('co2Reduction', 'co2.statedReduction'),
        },
      }

      const units = input.units.map((unit, i): UnitFigures => {
        quotes[`units.${i}.unitId`] = quoteOf(unit)
        const u = read(unit.figures, UNIT_FIGURES, ['units', i, 'figures'])
        const get = <T>(name: UnitFigure, key: keyof UnitFigures) => {
          const found = u.get(name)
          if (!found) return null
          quotes[`units.${i}.${key}`] = found.quote
          return found.value as T
        }
        return {
          unitId: unit.unitId,
          billingPeriod: get('billingPeriod', 'billingPeriod'),
          areaM2: get('areaM2', 'areaM2'),
          consumption: get('consumption', 'consumption'),
          amountCents: get('amount', 'amountCents'),
          estimated: get('estimated', 'estimated'),
        }
      })

      return { figures: { building, units }, quotes }
    })
}
