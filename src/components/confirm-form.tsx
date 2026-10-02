'use client'

import { type ReactNode, useActionState } from 'react'
import type { ExtractedFigures } from '@/lib/figures'
import { type FiguresFormState, figuresFormValues } from '@/lib/figures-form'

type Props = {
  action: (state: FiguresFormState, form: FormData) => Promise<FiguresFormState>
  extracted: ExtractedFigures
}

type Choice = { value: string; label: string }

const NOT_FOUND: Choice = { value: '', label: 'Nicht angegeben' }

const ALLOCATION_CHOICES: Choice[] = [
  { value: 'consumption_split', label: 'Nach Verbrauch und Fläche' },
  { value: 'area_only', label: 'Nur nach Fläche' },
  NOT_FOUND,
]
const DECIMALS_CHOICES: Choice[] = [
  { value: '0', label: 'Ganze m²' },
  { value: '1', label: '1 Nachkommastelle' },
  { value: '2', label: '2 Nachkommastellen' },
  NOT_FOUND,
]
const REDUCTION_CHOICES: Choice[] = [
  { value: 'none', label: 'Keine' },
  { value: 'halved', label: 'Vermieteranteil halbiert' },
  { value: 'no_split', label: 'Keine Aufteilung' },
  NOT_FOUND,
]
const ESTIMATED_CHOICES: Choice[] = [
  { value: 'nein', label: 'Nein' },
  { value: 'ja', label: 'Ja' },
  { value: '', label: '?' },
]

/** One spare empty row per table, so a Cost Item or Unit the Extractor missed can be added. */
const SPARE_ROWS = 1

/**
 * The Confirm screen: every Extracted Figure, editable, with where it appears
 * in the PDFs. One confirm covers the whole package.
 */
export function ConfirmForm({ action, extracted }: Props) {
  const [state, formAction, pending] = useActionState(action, {})
  const values = state.values ?? figuresFormValues(extracted.figures)
  const errors = state.errors ?? {}
  const { figures, sources } = extracted

  const source = (path: string) => {
    const ref = sources[path]
    return ref ? (
      <span className="source" title={`${ref.file}, Seite ${ref.page}`}>
        {ref.file} · S. {ref.page}
      </span>
    ) : (
      <span className="source source-missing">nicht gefunden</span>
    )
  }

  const error = (name: string) =>
    errors[name] && (
      <span className="error" id={`${name}-error`}>
        {errors[name]}
      </span>
    )

  const input = (name: string, props: { label?: string; inputMode?: 'decimal' | 'numeric'; type?: string } = {}) => (
    <input
      name={name}
      defaultValue={values[name] ?? ''}
      inputMode={props.inputMode}
      type={props.type}
      aria-label={props.label}
      aria-invalid={Boolean(errors[name])}
      aria-describedby={errors[name] ? `${name}-error` : undefined}
    />
  )

  const select = (name: string, choices: Choice[], label?: string) => (
    <select name={name} defaultValue={values[name] ?? ''} aria-label={label}>
      {choices.map((c) => (
        <option key={c.value} value={c.value}>
          {c.label}
        </option>
      ))}
    </select>
  )

  const field = (label: string, figurePath: string, control: ReactNode, errorName: string) => (
    <label className="figure">
      <span className="figure-label">
        {label} {source(figurePath)}
      </span>
      {control}
      {error(errorName)}
    </label>
  )

  const numberField = (label: string, name: string, figurePath: string) =>
    field(label, figurePath, input(name, { inputMode: 'decimal' }), name)

  const period = (prefix: string, figurePath: string, label: string) => (
    <fieldset className="figure">
      <legend>
        {label} {source(figurePath)}
      </legend>
      <div className="row">
        {input(`${prefix}.start`, { type: 'date', label: `${label}: Beginn` })}
        {input(`${prefix}.end`, { type: 'date', label: `${label}: Ende` })}
      </div>
      {error(prefix)}
    </fieldset>
  )

  const costItemRows = figures.building.costItems.length + SPARE_ROWS
  const unitRows = figures.units.length + SPARE_ROWS

  // Keyed by the values so a failed confirm shows what was submitted.
  return (
    <form action={formAction} className="stack" key={JSON.stringify(values)}>
      <p className="muted">
        Prüfen Sie die ausgelesenen Werte und korrigieren oder ergänzen Sie sie. Leere Felder gelten
        als „in der Abrechnung nicht angegeben“: Die betroffenen Prüfungen werden dann als „nicht
        prüfbar“ ausgewiesen. Nach dem Bestätigen sind die Werte nicht mehr änderbar.
      </p>

      <section className="stack">
        <h2>Gesamtabrechnung</h2>
        <div className="figures">
          {period('building.billingPeriod', 'building.billingPeriod', 'Abrechnungszeitraum')}
          {field('Gesamtkosten (€)', 'building.totalCostCents', input('building.totalCost', { inputMode: 'decimal' }), 'building.totalCost')}
          {numberField('Verbrauchsanteil Heizung (%)', 'building.heatingConsumptionSharePct', 'building.heatingConsumptionSharePct')}
          {numberField('Verbrauchsanteil Warmwasser (%)', 'building.hotWaterConsumptionSharePct', 'building.hotWaterConsumptionSharePct')}
          {field('Verteilung', 'building.allocationMethod', select('building.allocationMethod', ALLOCATION_CHOICES), 'building.allocationMethod')}
          {numberField('Gesamtfläche (m²)', 'building.totalArea', 'building.totalAreaM2')}
          {field('Flächen gedruckt mit', 'building.areaDecimals', select('building.areaDecimals', DECIMALS_CHOICES), 'building.areaDecimals')}
        </div>
        <fieldset className="figure">
          <legend>
            Brennstoff {source('building.fuel')}
          </legend>
          <div className="row">
            {input('building.fuel.type', { label: 'Brennstoff' })}
            {input('building.fuel.quantity', { label: 'Menge', inputMode: 'decimal' })}
            {input('building.fuel.unit', { label: 'Einheit' })}
          </div>
          {error('building.fuel.type')}
          {error('building.fuel.quantity')}
        </fieldset>

        <h3>Kostenpositionen</h3>
        <table className="table compact">
          <thead>
            <tr>
              <th>Bezeichnung (wie in der Abrechnung)</th>
              <th>Betrag (€)</th>
              <th>Fundstelle</th>
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: costItemRows }, (_, i) => {
              const prefix = `building.costItems.${i}`
              return (
                <tr key={i}>
                  <td>
                    {input(`${prefix}.name`, { label: `Kostenposition ${i + 1}: Bezeichnung` })}
                    {error(`${prefix}.name`)}
                  </td>
                  <td>
                    {input(`${prefix}.amount`, { label: `Kostenposition ${i + 1}: Betrag`, inputMode: 'decimal' })}
                    {error(`${prefix}.amount`)}
                  </td>
                  <td>{i < figures.building.costItems.length ? source(prefix) : <span className="muted">neu</span>}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </section>

      <section className="stack">
        <h2>CO₂-Angaben der Abrechnung</h2>
        <div className="figures">
          {numberField('CO₂-Ausstoß gesamt (kg)', 'building.co2.totalKg', 'building.co2.totalKg')}
          {numberField('kg CO₂ je m² und Jahr', 'building.co2.statedKgPerM2Year', 'building.co2.statedKgPerM2Year')}
          {field('Stufe (1–10)', 'building.co2.statedTier', input('building.co2.statedTier', { inputMode: 'numeric' }), 'building.co2.statedTier')}
          {field('CO₂-Kosten (€)', 'building.co2.costCents', input('building.co2.cost', { inputMode: 'decimal' }), 'building.co2.cost')}
          {field('Einschränkung nach §9', 'building.co2.statedReduction', select('building.co2.statedReduction', REDUCTION_CHOICES), 'building.co2.statedReduction')}
        </div>
        <fieldset className="figure">
          <legend>
            Aufteilung der CO₂-Kosten (%) {source('building.co2.statedSplit')}
          </legend>
          <div className="row">
            <label>
              Vermieter
              {input('building.co2.statedLandlordPct', { inputMode: 'decimal' })}
            </label>
            <label>
              Mieter
              {input('building.co2.statedTenantPct', { inputMode: 'decimal' })}
            </label>
          </div>
          {error('building.co2.statedSplit')}
          {error('building.co2.statedLandlordPct')}
          {error('building.co2.statedTenantPct')}
        </fieldset>
      </section>

      <section className="stack">
        <h2>Einzelabrechnungen</h2>
        <div className="table-scroll">
          <table className="table compact">
            <thead>
              <tr>
                <th>Nutzeinheit</th>
                <th>Abrechnungszeitraum</th>
                <th>Fläche (m²)</th>
                <th>Verbrauch</th>
                <th>Betrag (€)</th>
                <th>Geschätzt</th>
                <th>Fundstelle</th>
              </tr>
            </thead>
            <tbody>
              {Array.from({ length: unitRows }, (_, i) => {
                const prefix = `units.${i}`
                const unit = figures.units[i]?.unitId ?? `Nutzeinheit ${i + 1}`
                return (
                  <tr key={i}>
                    <td>
                      {input(`${prefix}.unitId`, { label: `Nutzeinheit ${i + 1}` })}
                      {error(`${prefix}.unitId`)}
                    </td>
                    <td>
                      <div className="period">
                        {input(`${prefix}.billingPeriod.start`, { type: 'date', label: `${unit}: Beginn` })}
                        {input(`${prefix}.billingPeriod.end`, { type: 'date', label: `${unit}: Ende` })}
                      </div>
                      {error(`${prefix}.billingPeriod`)}
                    </td>
                    <td>
                      {input(`${prefix}.area`, { label: `${unit}: Fläche`, inputMode: 'decimal' })}
                      {error(`${prefix}.area`)}
                    </td>
                    <td>
                      {input(`${prefix}.consumption`, { label: `${unit}: Verbrauch`, inputMode: 'decimal' })}
                      {error(`${prefix}.consumption`)}
                    </td>
                    <td>
                      {input(`${prefix}.amount`, { label: `${unit}: Betrag`, inputMode: 'decimal' })}
                      {error(`${prefix}.amount`)}
                    </td>
                    <td>{select(`${prefix}.estimated`, ESTIMATED_CHOICES, `${unit}: geschätzt`)}</td>
                    <td>{i < figures.units.length ? source(`${prefix}.amountCents`) : <span className="muted">neu</span>}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </section>

      {Object.keys(errors).length > 0 && (
        <p className="error" role="alert">
          Einige Werte konnten nicht gelesen werden. Bitte korrigieren Sie die markierten Felder.
        </p>
      )}
      {state.error && <p className="error" role="alert">{state.error}</p>}
      <div>
        <button type="submit" disabled={pending}>
          {pending ? 'Wird geprüft …' : 'Alle Werte bestätigen und prüfen'}
        </button>
      </div>
    </form>
  )
}
