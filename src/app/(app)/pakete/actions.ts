'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { type FiguresFormState, parseFiguresForm } from '@/lib/figures-form'
import { submittedValues } from '@/lib/form-values'
import { requireSignedIn } from '@/lib/session'
import { confirmPackage, extractPackage, type Registration, registerPackage } from '@/lib/statement-packages'
import type { UploadRequest } from '@/lib/upload'

const UPLOAD_FAILED = 'Das Abrechnungspaket konnte nicht angelegt werden. Bitte versuchen Sie es erneut.'
const CONFIRM_FAILED = 'Die Werte konnten nicht bestätigt werden. Bitte versuchen Sie es erneut.'

/** Step 1 of an upload: registers the package. The browser then uploads the PDFs. */
export async function registerStatementPackage(
  buildingId: string,
  request: UploadRequest,
): Promise<Registration> {
  await requireSignedIn()
  try {
    return await registerPackage(buildingId, {
      dispatchDate: String(request.dispatchDate),
      files: request.files.map(({ name, size }) => ({ name: String(name), size: Number(size) })),
    })
  } catch (error) {
    console.error('Registering a Statement Package failed', error)
    return { ok: false, error: UPLOAD_FAILED }
  }
}

/** Step 2, once the PDFs are uploaded; also the retry after a failed extraction. */
export async function extractStatementPackage(packageId: string) {
  await requireSignedIn()
  await extractPackage(packageId)
  revalidatePath('/')
  redirect(`/pakete/${packageId}`)
}

export async function confirmStatementPackage(
  packageId: string,
  _: FiguresFormState,
  form: FormData,
): Promise<FiguresFormState> {
  await requireSignedIn()
  const values = submittedValues(form)
  const result = parseFiguresForm(form)
  if (!result.ok) return { errors: result.errors, values }

  try {
    await confirmPackage(packageId, result.figures)
  } catch (error) {
    console.error(`Confirming Statement Package ${packageId} failed`, error)
    return { error: CONFIRM_FAILED, values }
  }
  // Also when it had already been confirmed elsewhere: the page shows its state.
  revalidatePath('/')
  redirect(`/pakete/${packageId}`)
}
