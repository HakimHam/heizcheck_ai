// Checks on an upload, shared by the browser (before sending anything) and the
// server (which can't trust the browser).

/** The storage bucket holding Statement Package PDFs. */
export const PDF_BUCKET = 'statement-packages'

/** Matches the storage bucket's limit. */
export const MAX_PDF_BYTES = 50 * 1024 * 1024
/** How many bytes `pdfProblem` needs to look at. */
export const PDF_SIGNATURE_BYTES = 5

export type UploadFile = { name: string; size: number }
export type UploadRequest = { dispatchDate: string; files: UploadFile[] }

const SIGNATURE = '%PDF-'

const namedProblem = ({ name, size }: UploadFile): string | null => {
  if (!/\.pdf$/i.test(name)) return `„${name}“ ist keine PDF-Datei.`
  if (size <= 0) return `„${name}“ ist leer.`
  if (size > MAX_PDF_BYTES) return `„${name}“ ist größer als 50 MB.`
  return null
}

/** Why a file can't be part of a Statement Package, in German, or null if it can. */
export function pdfProblem(file: UploadFile, firstBytes: Uint8Array): string | null {
  const problem = namedProblem(file)
  if (problem) return problem
  const signature = String.fromCharCode(...firstBytes.slice(0, PDF_SIGNATURE_BYTES))
  return signature === SIGNATURE ? null : `„${file.name}“ ist keine lesbare PDF-Datei.`
}

export const isIsoDate = (value: string) =>
  /^\d{4}-\d{2}-\d{2}$/.test(value) &&
  new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) === value

/** Why an upload can't be accepted, in German, or null if it can. */
export function uploadProblem({ dispatchDate, files }: UploadRequest): string | null {
  if (!isIsoDate(dispatchDate)) return 'Bitte geben Sie ein gültiges Versanddatum an.'
  if (files.length === 0) return 'Bitte wählen Sie mindestens eine PDF-Datei aus.'
  for (const file of files) {
    const problem = namedProblem(file)
    if (problem) return problem
  }
  return null
}
