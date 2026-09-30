"use client";

import { useActionState } from "react";
import type { BuildingFormState } from "@/lib/buildings/actions";
import type { BuildingFormField, BuildingFormValues } from "@/lib/buildings/building-form";

type Props = {
  action: (state: BuildingFormState, formData: FormData) => Promise<BuildingFormState>;
  initialValues: BuildingFormValues;
  submitLabel: string;
  initialNotice?: string;
};

type Option = { value: string; label: string };

const YES_NO_UNKNOWN: Option[] = [
  { value: "true", label: "Ja" },
  { value: "false", label: "Nein" },
  { value: "", label: "Unbekannt" },
];

const CO2_REDUCTION_OPTIONS: Option[] = [
  { value: "none", label: "Keine Minderung" },
  { value: "heritage", label: "Denkmalschutz: Vermieteranteil wird halbiert" },
  { value: "district_heating", label: "Vorgeschriebene Fernwärmeversorgung: keine Aufteilung" },
  { value: "", label: "Unbekannt" },
];

export function BuildingForm({ action, initialValues, submitLabel, initialNotice }: Props) {
  const [state, formAction, pending] = useActionState(action, { notice: initialNotice });
  const values = { ...initialValues, ...state.values };
  const errors = state.errors ?? {};

  return (
    <form action={formAction} className="flex flex-col gap-6" noValidate>
      <Section title="Gebäude">
        <TextField
          name="address"
          label="Adresse"
          hint="Straße, Hausnummer, PLZ und Ort"
          autoComplete="street-address"
          defaultValue={values.address}
          error={errors.address}
        />
        <RadioGroup
          name="residential"
          legend="Ist das Gebäude ein Wohngebäude?"
          hint="Nichtwohngebäude und gemischt genutzte Gebäude liegen außerhalb des Prüfumfangs von HeizCheck."
          options={[
            { value: "true", label: "Ja" },
            { value: "false", label: "Nein" },
          ]}
          defaultValue={values.residential}
          error={errors.residential}
        />
      </Section>

      <Section
        title="Gebäudeprofil"
        intro="Diese Angaben liefert der Messdienstleister nicht. HeizCheck vergleicht die Abrechnung mit ihnen. Lassen Sie ein Feld leer oder wählen Sie „Unbekannt“, wenn Sie es nicht wissen: Die betroffenen Prüfungen werden dann als „nicht prüfbar“ ausgewiesen, statt mit einer Annahme zu rechnen."
      >
        <TextField
          name="livingArea"
          label="Wohnfläche in m²"
          hint="Für die CO₂-Einstufung nach CO2KostAufG."
          inputMode="decimal"
          defaultValue={values.livingArea}
          error={errors.livingArea}
        />
        <TextField
          name="heatedArea"
          label="Beheizte Fläche in m²"
          hint="Die Fläche, nach der die Heizkosten verteilt werden. Die Flächen der Nutzeinheiten müssen sich zu ihr addieren."
          inputMode="decimal"
          defaultValue={values.heatedArea}
          error={errors.heatedArea}
        />
        <RadioGroup
          name="mandatory70Pct"
          legend="Ist ein Verbrauchsanteil von genau 70 % vorgeschrieben (§ 7 Abs. 1 Satz 2 HeizkostenV)?"
          hint="Gilt für Gebäude, die das Anforderungsniveau der Wärmeschutzverordnung vom 16. August 1994 nicht erfüllen, mit Öl oder Gas beheizt werden und deren freiliegende Leitungen der Wärmeverteilung überwiegend gedämmt sind."
          options={YES_NO_UNKNOWN}
          defaultValue={values.mandatory70Pct}
          error={errors.mandatory70Pct}
        />
        <RadioGroup
          name="co2Reduction"
          legend="Minderung des Vermieteranteils an den CO₂-Kosten (§ 9 CO2KostAufG)"
          options={CO2_REDUCTION_OPTIONS}
          defaultValue={values.co2Reduction}
          error={errors.co2Reduction}
        />
      </Section>

      {state.error && (
        <p role="alert" className="text-sm text-red-700">
          {state.error}
        </p>
      )}
      {state.notice && !pending && (
        <p role="status" className="text-sm text-green-800">
          {state.notice}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded bg-stone-900 px-4 py-2 font-medium text-white disabled:opacity-60"
      >
        {pending ? "Bitte warten …" : submitLabel}
      </button>
    </form>
  );
}

function Section({ title, intro, children }: { title: string; intro?: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-4 rounded border border-stone-200 bg-white p-4">
      <h2 className="text-lg font-semibold">{title}</h2>
      {intro && <p className="text-sm text-stone-600">{intro}</p>}
      {children}
    </section>
  );
}

type TextFieldProps = {
  name: BuildingFormField;
  label: string;
  hint?: string;
  defaultValue: string;
  error?: string;
  autoComplete?: string;
  inputMode?: "decimal";
};

function TextField({ name, label, hint, defaultValue, error, autoComplete, inputMode }: TextFieldProps) {
  return (
    <label className="flex flex-col gap-1 text-sm font-medium">
      {label}
      {hint && <span className="font-normal text-stone-600">{hint}</span>}
      <input
        name={name}
        type="text"
        autoComplete={autoComplete ?? "off"}
        inputMode={inputMode}
        defaultValue={defaultValue}
        aria-invalid={error ? true : undefined}
        className="rounded border border-stone-300 bg-white px-3 py-2 text-base font-normal aria-invalid:border-red-700"
      />
      {error && <span className="font-normal text-red-700">{error}</span>}
    </label>
  );
}

type RadioGroupProps = {
  name: BuildingFormField;
  legend: string;
  hint?: string;
  options: Option[];
  defaultValue: string;
  error?: string;
};

function RadioGroup({ name, legend, hint, options, defaultValue, error }: RadioGroupProps) {
  return (
    <fieldset className="flex flex-col gap-1 text-sm">
      <legend className="font-medium">{legend}</legend>
      {hint && <p className="text-stone-600">{hint}</p>}
      <div className="mt-1 flex flex-col gap-1">
        {options.map((o) => (
          <label key={o.value} className="flex items-center gap-2">
            <input type="radio" name={name} value={o.value} defaultChecked={defaultValue === o.value} />
            {o.label}
          </label>
        ))}
      </div>
      {error && <p className="text-red-700">{error}</p>}
    </fieldset>
  );
}
