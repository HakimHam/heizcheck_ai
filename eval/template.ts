import type { Figures, UnitFigures } from '../src/lib/figures'

// A synthetic Statement Package in the Minol layout: the Building Statement
// (costs, then the CO₂ split) and one page per Unit Statement. Every figure
// that is null is left off the page, so the expected figures are exactly the
// figures printed. Each page is an A4 section at 96 dpi; `htmlDocument` makes
// them printable.

/** Some labels are worded differently, as different statements word them. */
export type Wording = 'a' | 'b'

const LABELS = {
  a: {
    title: 'Heizkostenabrechnung – Gesamtabrechnung',
    period: 'Abrechnungszeitraum',
    total: 'Summe der Heiz- und Warmwasserkosten',
    area: 'Gesamtwohnfläche',
    unitTitle: 'Einzelabrechnung Heiz- und Warmwasserkosten',
    unitAmount: 'Ihr Anteil an den Kosten',
    consumption: 'Verbrauch Heizung',
  },
  b: {
    title: 'Abrechnung über Heiz- und Warmwasserkosten (Gesamt)',
    period: 'Zeitraum',
    total: 'Gesamtkosten',
    area: 'Beheizte Fläche gesamt',
    unitTitle: 'Ihre Heizkostenabrechnung',
    unitAmount: 'Kostenanteil Nutzeinheit',
    consumption: 'Ermittelter Verbrauch',
  },
}

const number = (value: number, decimals: number) =>
  new Intl.NumberFormat('de-DE', { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(value)
const plain = (value: number) => new Intl.NumberFormat('de-DE', { maximumFractionDigits: 3 }).format(value)
const euros = (cents: number) => `${number(cents / 100, 2)} €`
const date = (iso: string) => iso.split('-').reverse().join('.')
const escape = (text: string) => text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const STYLE = `
  @page { size: A4; margin: 0 }
  html, body { margin: 0 }
  body { font: 13px/1.45 Arial, Helvetica, sans-serif; color: #111 }
  .page { box-sizing: border-box; width: 794px; height: 1122px; overflow: hidden; padding: 56px 64px; break-after: page }
  .page:last-child { break-after: auto }
  .brand { display: flex; justify-content: space-between; border-bottom: 3px solid #0a5c9c; padding-bottom: 10px; margin-bottom: 18px }
  .brand b { color: #0a5c9c; font-size: 20px; letter-spacing: 1px }
  h1 { font-size: 17px; margin: 0 0 14px }
  h2 { font-size: 14px; margin: 22px 0 6px; color: #0a5c9c }
  table { border-collapse: collapse; width: 100% }
  td { padding: 4px 6px; border-bottom: 1px solid #ccc }
  td.n { text-align: right; white-space: nowrap }
  tr.sum td { font-weight: bold; border-top: 2px solid #111 }
  .note { margin-top: 18px; font-size: 11px; color: #444 }
`

/** One A4 page of a statement, as an HTML section. */
const page = (body: string) => `<section class="page">
<div class="brand"><b>MESSDIENST NORD</b><span>Liegenschaft 4711 · Lindenweg 12 · 20095 Hamburg</span></div>
${body}
</section>`

/** A printable HTML document of the given pages. */
export const htmlDocument = (pages: string[]) =>
  `<!doctype html><html lang="de"><head><meta charset="utf-8"><style>${STYLE}</style></head><body>${pages.join('\n')}</body></html>`

const row = (label: string, value: string | null) =>
  value === null ? '' : `<tr><td>${escape(label)}</td><td class="n">${escape(value)}</td></tr>`

const area = (m2: number | null, decimals: number) => (m2 === null ? null : `${number(m2, decimals)} m²`)

/** The allocation split; the shares are printed only with the method they belong to. */
function allocationRows(b: Figures['building']) {
  if (b.allocationMethod === null) return ''
  if (b.allocationMethod === 'area_only') return row('Verteilung Heizkosten', '100 % nach Wohnfläche')
  const split = (label: string, pct: number | null) =>
    pct === null ? '' : row(label, `${plain(pct)} % Verbrauch / ${plain(100 - pct)} % Grundkosten`)
  return (
    split('Verteilung Heizkosten', b.heatingConsumptionSharePct) +
    split('Verteilung Warmwasserkosten', b.hotWaterConsumptionSharePct)
  )
}

export function buildingPages(figures: Figures, wording: Wording): string[] {
  const b = figures.building
  const l = LABELS[wording]
  const decimals = b.areaDecimals ?? 1

  const costs = `<table>
${b.costItems.map((item) => `<tr><td>${escape(item.name)}</td><td class="n">${item.amountCents === null ? '' : euros(item.amountCents)}</td></tr>`).join('\n')}
${b.totalCostCents === null ? '' : `<tr class="sum"><td>${l.total}</td><td class="n">${euros(b.totalCostCents)}</td></tr>`}
</table>`

  const first = page(`<h1>${l.title}</h1>
<table>
${row(l.period, b.billingPeriod && `${date(b.billingPeriod.start)} – ${date(b.billingPeriod.end)}`)}
${row(l.area, area(b.totalAreaM2, decimals))}
${b.fuel === null ? '' : row('Brennstoff', `${escape(b.fuel.type)}${b.fuel.quantity === null ? '' : `, ${plain(b.fuel.quantity)} ${b.fuel.unit}`}`)}
${allocationRows(b)}
</table>
<h2>Kostenaufstellung</h2>
${costs}`)

  const c = b.co2
  const reduction = {
    none: 'keine Minderung',
    halved: 'Halbierung des Vermieteranteils nach § 9 Abs. 1 CO2KostAufG',
    no_split: 'keine Aufteilung nach § 9 Abs. 2 CO2KostAufG',
  }
  const co2Rows = [
    row('CO₂-Emissionen gesamt', c.totalKg === null ? null : `${plain(c.totalKg)} kg`),
    row('CO₂-Ausstoß je m² Wohnfläche und Jahr', c.statedKgPerM2Year === null ? null : `${plain(c.statedKgPerM2Year)} kg CO₂/m²/a`),
    row('Einstufung', c.statedTier === null ? null : `Stufe ${c.statedTier}`),
    row('Anteil Vermieter', c.statedSplit && `${plain(c.statedSplit.landlordPct)} %`),
    row('Anteil Mieter', c.statedSplit && `${plain(c.statedSplit.tenantPct)} %`),
    row('CO₂-Kosten', c.costCents === null ? null : euros(c.costCents)),
    row('Minderung', c.statedReduction && reduction[c.statedReduction]),
  ].join('')

  return co2Rows
    ? [first, page(`<h1>Aufteilung der Kohlendioxidkosten</h1><table>${co2Rows}</table>`)]
    : [first]
}

export function unitPages(figures: Figures, wording: Wording): string[] {
  const l = LABELS[wording]
  const decimals = figures.building.areaDecimals ?? 1
  return figures.units.map((unit: UnitFigures) =>
    page(`<h1>${l.unitTitle}</h1>
<table>
${row('Nutzeinheit', unit.unitId)}
${row(l.period, unit.billingPeriod && `${date(unit.billingPeriod.start)} – ${date(unit.billingPeriod.end)}`)}
${row('Wohnfläche', area(unit.areaM2, decimals))}
${row(l.consumption, unit.consumption === null ? null : `${plain(unit.consumption)} Einheiten${unit.estimated ? ' *' : ''}`)}
${unit.amountCents === null ? '' : `<tr class="sum"><td>${l.unitAmount}</td><td class="n">${euros(unit.amountCents)}</td></tr>`}
</table>
${unit.estimated === true ? '<p class="note">* Die Verbrauchswerte wurden geschätzt, da keine Ablesung möglich war.</p>' : ''}
${unit.estimated === false ? '<p class="note">Alle Verbrauchswerte wurden abgelesen.</p>' : ''}`),
  )
}
