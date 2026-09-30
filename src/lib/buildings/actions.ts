"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { parseBuildingForm, toFormValues, type BuildingFormErrors, type BuildingFormValues } from "./building-form";
import { profileToRow } from "./building-profile";

export type BuildingFormState = {
  errors?: BuildingFormErrors;
  error?: string;
  notice?: string;
  /** What was submitted, so the form shows it again instead of resetting. */
  values?: Partial<BuildingFormValues>;
};

const SAVE_FAILED = "Das Gebäude konnte nicht gespeichert werden. Bitte versuchen Sie es erneut.";

const submittedValues = (formData: FormData) =>
  Object.fromEntries(
    [...formData.entries()].filter(([name]) => !name.startsWith("$")).map(([name, value]) => [name, String(value)]),
  );

/** Creates a building in the signed-in user's Organisation and opens its Building Profile. */
export async function createBuilding(_state: BuildingFormState, formData: FormData): Promise<BuildingFormState> {
  const parsed = parseBuildingForm(formData);
  if (!parsed.ok) return { errors: parsed.errors, values: submittedValues(formData) };

  const supabase = await createClient();
  // organisation_id defaults to the user's Organisation; row-level security refuses any other.
  const { data, error } = await supabase
    .from("buildings")
    .insert({ address: parsed.building.address, ...profileToRow(parsed.building.profile) })
    .select("id")
    .single<{ id: string }>();
  if (error) return { error: SAVE_FAILED, values: submittedValues(formData) };

  revalidatePath("/");
  redirect(`/gebaeude/${data.id}?angelegt=1`);
}

/** Saves a building's address and Building Profile. Existing Check Reports keep their own snapshot. */
export async function updateBuilding(
  buildingId: string,
  _state: BuildingFormState,
  formData: FormData,
): Promise<BuildingFormState> {
  const parsed = parseBuildingForm(formData);
  if (!parsed.ok) return { errors: parsed.errors, values: submittedValues(formData) };

  const supabase = await createClient();
  // Row-level security matches no row for a building of another Organisation.
  const { data, error } = await supabase
    .from("buildings")
    .update({ address: parsed.building.address, ...profileToRow(parsed.building.profile) })
    .eq("id", buildingId)
    .select("id");
  if (error || data.length === 0) return { error: SAVE_FAILED, values: submittedValues(formData) };

  revalidatePath("/");
  revalidatePath(`/gebaeude/${buildingId}`);
  // Show what was stored, e.g. "1.234,5" comes back as "1234,5".
  return { notice: "Gebäudeprofil gespeichert.", values: toFormValues(parsed.building) };
}
