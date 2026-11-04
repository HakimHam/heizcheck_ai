/** A Statement Package's place in its lifecycle. */
export type PackageStatus =
  | 'uploaded'
  | 'extracting'
  | 'extraction_failed'
  | 'awaiting_confirmation'
  | 'confirmed'
  | 'checked'

/**
 * How long an extraction may run before it counts as stuck (e.g. the server
 * was stopped mid-run) and may be started again.
 */
export const EXTRACTION_TIMEOUT_MS = 5 * 60 * 1000

export const isExtractionStuck = (status: PackageStatus, updatedAt: string, now: Date) =>
  status === 'extracting' && now.getTime() - new Date(updatedAt).getTime() > EXTRACTION_TIMEOUT_MS

export const PACKAGE_STATUS_LABELS: Record<PackageStatus, string> = {
  uploaded: 'Hochgeladen',
  extracting: 'Wird ausgelesen',
  extraction_failed: 'Auslesen fehlgeschlagen',
  awaiting_confirmation: 'Wartet auf Bestätigung',
  confirmed: 'Bestätigt',
  checked: 'Geprüft',
}

/** The steps shown as progress. */
export const PROGRESS_STEPS = ['Hochladen', 'Auslesen', 'Werte bestätigen', 'Prüfen'] as const

/** How many of `PROGRESS_STEPS` are done; the next one is in progress (or failed). */
export const STEPS_DONE: Record<PackageStatus, number> = {
  uploaded: 1,
  extracting: 1,
  extraction_failed: 1,
  awaiting_confirmation: 2,
  confirmed: 3,
  checked: 4,
}
