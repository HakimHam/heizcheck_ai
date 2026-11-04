'use server'

import { notFound, redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { type BuildingFormState, parseBuildingForm } from '@/lib/building-form'
import { insertBuilding, updateBuilding } from '@/lib/buildings'
import { submittedValues as submitted } from '@/lib/form-values'
import { requireSignedIn } from '@/lib/session'

const SAVE_FAILED = 'Das Gebäude konnte nicht gespeichert werden. Bitte versuchen Sie es erneut.'

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
