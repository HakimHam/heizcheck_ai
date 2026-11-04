'use client'

import { useActionState } from 'react'
import type { BuildingFormState, BuildingFormValues } from '@/lib/building-form'
import { CO2_REDUCTIONS, type Co2Reduction } from '@/lib/building-profile'

type Props = {
  action: (state: BuildingFormState, form: FormData) => Promise<BuildingFormState>
  initialValues?: BuildingFormValues
  submitLabel: string
}

type Choice = { value: string; label: string }

const UNKNOWN: Choice = { value: '', label: 'Unbekannt' }
const YES_NO: Choice[] = [
  { value: 'ja', label: 'Ja' },
  { value: 'nein', label: 'Nein' },
]

const CO2_REDUCTION_LABELS: Record<Co2Reduction, string> = {
  none: 'Keine',
  heritage: 'Denkmalschutz oder vergleichbare Vorgaben',
  district_heating: 'Pflicht zur Nutzung von Fernwärme',
}

const EMPTY: BuildingFormValues = {
  street: '',
  postalCode: '',
  city: '',
  residential: '',
  livingArea: '',
  heatedArea: '',
  mandatory70Pct: '',
  co2Reduction: '',
}

export function BuildingForm({ action, initialValues = EMPTY, submitLabel }: Props) {
  const [state, formAction, pending] = useActionState(action, {})
  const values: Record<string, string> = state.values ?? initialValues
  const errors = state.errors ?? {}

  const fieldError = (name: keyof typeof errors) =>
    errors[name] && (
      <span className="error" id={`${name}-error`}>
        {errors[name]}
      </span>
    )

  const choices = (
    name: string,
    legend: string,
    options: Choice[],
    hint?: string,
    required = false,
  ) => (
    <fieldset aria-describedby={errors[name as keyof typeof errors] ? `${name}-error` : undefined}>
      <legend>{legend}</legend>
      {hint && <p className="hint">{hint}</p>}
      <div className="choices">
        {options.map((option) => (
          <label key={option.value} className="choice">
            <input
              type="radio"
              name={name}
              value={option.value}
              defaultChecked={values[name] === option.value}
              required={required}
            />
            {option.label}
          </label>
        ))}
      </div>
      {fieldError(name as keyof typeof errors)}
    </fieldset>
  )

  const areaField = (name: 'livingArea' | 'heatedArea', label: string, hint: string) => (
    <label>
      {label}
      <span className="hint">{hint}</span>
      <input
        name={name}
        inputMode="decimal"
        placeholder="z. B. 812,45"
        defaultValue={values[name]}
        aria-invalid={Boolean(errors[name])}
      />
      {fieldError(name)}
    </label>
  )

  // Keyed by the values so a failed save shows what was submitted.
  return (
    <form action={formAction} className="stack" key={JSON.stringify(values)}>
      <section className="stack">
        <h2>Adresse</h2>
        <label>
          Straße und Hausnummer
          <input name="street" defaultValue={values.street} required autoComplete="street-address" />
          {fieldError('street')}
        </label>
        <div className="row">
          <label className="postal-code">
            PLZ
            <input
              name="postalCode"
              defaultValue={values.postalCode}
              required
              inputMode="numeric"
              pattern="[0-9]{5}"
              autoComplete="postal-code"
            />
            {fieldError('postalCode')}
          </label>
          <label className="grow">
            Ort
            <input name="city" defaultValue={values.city} required autoComplete="address-level2" />
            {fieldError('city')}
          </label>
        </div>
      </section>

      <section className="stack">
        <h2>Gebäudeprofil</h2>
        <p className="muted">
          Angaben, die nicht in der Abrechnung des Messdienstleisters stehen. Sie gelten für alle
          Abrechnungszeiträume. Lassen Sie Unbekanntes leer, statt zu schätzen: HeizCheck trifft dann
          keine Annahme, sondern weist betroffene Prüfungen als „nicht prüfbar“ aus oder gibt einen
          Prüfhinweis.
        </p>
        {choices(
          'residential',
          'Wohngebäude?',
          YES_NO,
          'Gebäude, die überwiegend nicht zu Wohnzwecken genutzt werden, liegen außerhalb des Prüfumfangs von HeizCheck.',
          true,
        )}
        {areaField('livingArea', 'Wohnfläche (m²)', 'Grundlage für den CO₂-Ausstoß je m² (CO2KostAufG).')}
        {areaField(
          'heatedArea',
          'Beheizte Fläche (m²)',
          'Wird mit der Summe der Flächen der Nutzeinheiten in der Abrechnung verglichen.',
        )}
        {choices(
          'mandatory70Pct',
          'Verbrauchsanteil zwingend 70 % (§7 Abs. 1 Satz 2 HeizkostenV)?',
          [...YES_NO, UNKNOWN],
          'Gilt nur, wenn alles zutrifft: Gebäude, die nicht dem Standard der Wärmeschutzverordnung 1994 entsprechen, mit Öl- oder Gasheizung und überwiegend gedämmten sichtbaren Wärmeleitungen.',
        )}
        {choices(
          'co2Reduction',
          'Einschränkung nach §9 CO2KostAufG',
          [
            ...CO2_REDUCTIONS.map((value) => ({ value, label: CO2_REDUCTION_LABELS[value] })),
            UNKNOWN,
          ],
          'Bei solchen Vorgaben verringert sich der CO₂-Kostenanteil des Vermieters oder entfällt die Aufteilung.',
        )}
      </section>

      {state.error && <p className="error" role="alert">{state.error}</p>}
      {state.saved && !pending && <p className="notice" role="status">Gespeichert.</p>}
      <div>
        <button type="submit" disabled={pending}>
          {pending ? 'Bitte warten …' : submitLabel}
        </button>
      </div>
    </form>
  )
}
