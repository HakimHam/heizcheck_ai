'use server'

import { notFound, redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { type BuildingFormState, parseBuildingForm } from '@/lib/building-form'
import { insertBuilding, updateBuilding } from '@/lib/buildings'
import { createClient } from '@/lib/supabase/server'

const SAVE_FAILED = 'Das Gebäude konnte nicht gespeichert werden. Bitte versuchen Sie es erneut.'

const submitted = (form: FormData) =>
  Object.fromEntries([...form.entries()].map(([name, value]) => [name, String(value)]))

// Server Actions can be called directly, so check the session here as well as
// in the proxy. RLS then limits every write to the user's Organisation.
async function requireSignedIn() {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  if (!data?.claims) redirect('/anmelden')
}

export async function createBuilding(
  _: BuildingFormState,
  form: FormData,
): Promise<BuildingFormState> {
  await requireSignedIn()
  const result = parseBuildingForm(form)
  if (!result.ok) return { errors: result.errors, values: submitted(form) }

  let id: string
  try {
    id = await insertBuilding(result.building)
  } catch {
    return { error: SAVE_FAILED, values: submitted(form) }
  }
  revalidatePath('/')
  redirect(`/gebaeude/${id}`)
}

export async function saveBuilding(
  id: string,
  _: BuildingFormState,
  form: FormData,
): Promise<BuildingFormState> {
  await requireSignedIn()
  const result = parseBuildingForm(form)
  if (!result.ok) return { errors: result.errors, values: submitted(form) }

  let found: boolean
  try {
    found = await updateBuilding(id, result.building)
  } catch {
    return { error: SAVE_FAILED, values: submitted(form) }
  }
  if (!found) notFound()
  revalidatePath('/')
  revalidatePath(`/gebaeude/${id}`)
  return { saved: true, values: submitted(form) }
}
