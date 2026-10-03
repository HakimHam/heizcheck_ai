import type { ExtractedFigures, Figures, SourceReference } from './figures'

// Where a Confirm screen field's figure appears in the PDFs. Field names are
// figure paths, except where the form takes a figure in other units (euros
// for cents) or splits it (a Billing Period's start and end).

/** Form field segments whose figure has another name. */
const RENAMED: Record<string, string> = {
  totalCost: 'totalCostCents',
  totalArea: 'totalAreaM2',
  cost: 'costCents',
  amount: 'amountCents',
  area: 'areaM2',
  statedLandlordPct: 'statedSplit.landlordPct',
  statedTenantPct: 'statedSplit.tenantPct',
}

/**
 * The source of the figure a field edits, or of the nearest figure it is part
 * of (a Billing Period, a Cost Item, a Unit Statement). Never the whole
 * Building Statement or all Units: that would point nowhere in particular.
 */
export function sourceOfField(
  field: string,
  sources: ExtractedFigures['sources'],
): SourceReference | null {
  const path = field.split('.').flatMap((segment) => (RENAMED[segment] ?? segment).split('.'))
  for (let length = path.length; length >= 2; length--) {
    const source = sources[path.slice(0, length).join('.')]
    if (source) return source
  }
  return null
}

/**
 * How many figures the Extractor didn't find. A figure entered in several
 * fields (a Billing Period, the fuel, the CO₂ split) counts once.
 */
export function countNotFound({ building, units }: Figures): number {
  const { costItems, fuel, co2, ...rest } = building
  const figures: unknown[] = [
    ...Object.values(rest),
    fuel === null ? null : fuel.quantity,
    ...Object.values(co2),
    ...costItems.map((item) => item.amountCents),
    ...units.flatMap(({ unitId: _, ...unit }) => Object.values(unit)),
  ]
  return figures.filter((figure) => figure === null).length
}
