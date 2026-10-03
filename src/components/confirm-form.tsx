'use client'

import { type FocusEvent, type ReactNode, useActionState, useState } from 'react'
import { countNotFound, sourceOfField } from '@/lib/figure-sources'
import type { ExtractedFigures } from '@/lib/figures'
import { type FiguresFormState, figuresFormValues } from '@/lib/figures-form'
import type { PdfLink } from '@/lib/statement-packages'
import { PdfSourceViewer, type Selection } from './pdf-source-viewer'

type Props = {
  action: (state: FiguresFormState, form: FormData) => Promise<FiguresFormState>
  extracted: ExtractedFigures
  pdfs: PdfLink[]
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
 * The Confirm screen: every Extracted Figure, editable, next to the PDFs.
 * Selecting a figure shows where it appears. One confirm covers the whole package.
 */
export function ConfirmForm({ action, extracted, pdfs }: Props) {
  const [state, formAction, pending] = useActionState(action, {})
  const extractedValues = figuresFormValues(extracted.figures)
  const values = state.values ?? extractedValues
  const errors = state.errors ?? {}
  const { figures, sources } = extracted
  const [selection, setSelection] = useState<Selection>()
  const notFound = countNotFound(figures)

  // A new Selection each time, so selecting a figure again shows its source again.
  const showSource = (name: string) => setSelection({ source: sourceOfField(name, sources) })

  const onFocus = (event: FocusEvent<HTMLFormElement>) => {
    const name = event.target.getAttribute('name')
    if (name) showSource(name)
  }

  const source = (name: string) => {
    const ref = sourceOfField(name, sources)
    return ref ? (
      <button
        type="button"
        className="source"
        title={`In der PDF-Datei zeigen: ${ref.file}, Seite ${ref.page}`}
        onClick={() => showSource(name)}
      >
        {ref.file} · S. {ref.page}
      </button>
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

  // A figure not found stays marked while it is empty. Spare rows hold no figure yet.
  const notFoundClass = (name: string) =>
    extractedValues[name] === '' ? 'not-found' : undefined

  const input = (name: string, props: { label?: string; inputMode?: 'decimal' | 'numeric'; type?: string } = {}) => (
    <input
      name={name}
      defaultValue={values[name] ?? ''}
      inputMode={props.inputMode}
      type={props.type}
      className={notFoundClass(name)}
      placeholder={notFoundClass(name) && 'nicht gefunden'}
      aria-label={props.label}
      aria-invalid={Boolean(errors[name])}
      aria-describedby={errors[name] ? `${name}-error` : undefined}
    />
  )

  const choice = (name: string, choices: Choice[], label?: string) => (
    <select
      name={name}
      defaultValue={values[name] ?? ''}
      className={notFoundClass(name)}
      aria-label={label}
    >
      {choices.map((c) => (
        <option key={c.value} value={c.value}>
          {c.label}
        </option>
      ))}
    </select>
  )

  const field = (label: string, name: string, control: ReactNode) => (
    <label className="figure">
      <span className="figure-label">
        {label} {source(name)}
      </span>
      {control}
      {error(name)}
    </label>
  )

  const numberField = (label: string, name: string) =>
    field(label, name, input(name, { inputMode: 'decimal' }))

  const period = (prefix: string, label: string) => (
    <fieldset className="figure">
      <legend>
        {label} {source(prefix)}
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
    <div className="confirm-layout">
      <form action={formAction} onFocus={onFocus} className="stack" key={JSON.stringify(values)}>
        <p className="muted">
          Prüfen Sie die ausgelesenen Werte und korrigieren oder ergänzen Sie sie. Wählen Sie einen
          Wert, um seine Fundstelle in der PDF-Datei zu sehen. Leere Felder gelten als „in der
          Abrechnung nicht angegeben“: Die betroffenen Prüfungen werden dann als „nicht prüfbar“
          ausgewiesen. Nach dem Bestätigen sind die Werte nicht mehr änderbar.
        </p>
        {notFound > 0 && (
          <p className="banner banner-missing" role="note">
            {notFound === 1
              ? '1 Wert wurde in der Abrechnung nicht gefunden. Er ist markiert und kann ergänzt werden.'
              : `${notFound} Werte wurden in der Abrechnung nicht gefunden. Sie sind markiert und können ergänzt werden.`}
          </p>
        )}

        <section className="stack">
          <h2>Gesamtabrechnung</h2>
          <div className="figures">
            {period('building.billingPeriod', 'Abrechnungszeitraum')}
            {numberField('Gesamtkosten (€)', 'building.totalCost')}
            {numberField('Verbrauchsanteil Heizung (%)', 'building.heatingConsumptionSharePct')}
            {numberField('Verbrauchsanteil Warmwasser (%)', 'building.hotWaterConsumptionSharePct')}
            {field('Verteilung', 'building.allocationMethod', choice('building.allocationMethod', ALLOCATION_CHOICES))}
            {numberField('Gesamtfläche (m²)', 'building.totalArea')}
            {field('Flächen gedruckt mit', 'building.areaDecimals', choice('building.areaDecimals', DECIMALS_CHOICES))}
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
            {numberField('CO₂-Ausstoß gesamt (kg)', 'building.co2.totalKg')}
            {numberField('kg CO₂ je m² und Jahr', 'building.co2.statedKgPerM2Year')}
            {field('Stufe (1–10)', 'building.co2.statedTier', input('building.co2.statedTier', { inputMode: 'numeric' }))}
            {numberField('CO₂-Kosten (€)', 'building.co2.cost')}
            {field('Einschränkung nach §9', 'building.co2.statedReduction', choice('building.co2.statedReduction', REDUCTION_CHOICES))}
          </div>
          <fieldset className="figure">
            <legend>
              Aufteilung der CO₂-Kosten (%) {source('building.co2.statedLandlordPct')}
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
                      <td>{choice(`${prefix}.estimated`, ESTIMATED_CHOICES, `${unit}: geschätzt`)}</td>
                      <td>{i < figures.units.length ? source(`${prefix}.unitId`) : <span className="muted">neu</span>}</td>
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
      <PdfSourceViewer files={pdfs} selection={selection} />
    </div>
  )
}
