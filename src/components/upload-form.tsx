'use client'

import { type FormEvent, useState, useTransition } from 'react'
import { extractStatementPackage, registerStatementPackage } from '@/app/(app)/pakete/actions'
import { createClient } from '@/lib/supabase/browser'
import { PDF_BUCKET, PDF_SIGNATURE_BYTES, pdfProblem } from '@/lib/upload'

type Props = { buildingId: string; defaultDispatchDate: string }

/**
 * Registers the package, uploads each PDF straight to storage, then starts
 * extraction, which redirects to the package.
 */
export function UploadForm({ buildingId, defaultDispatchDate }: Props) {
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const busy = pending || progress !== null

  async function upload(form: HTMLFormElement) {
    const data = new FormData(form)
    const files = data.getAll('files').filter((f): f is File => f instanceof File && f.name !== '')
    const dispatchDate = String(data.get('dispatchDate') ?? '')

    for (const file of files) {
      const firstBytes = new Uint8Array(await file.slice(0, PDF_SIGNATURE_BYTES).arrayBuffer())
      const problem = pdfProblem(file, firstBytes)
      if (problem) return setError(problem)
    }

    setProgress('Abrechnungspaket wird angelegt …')
    const registration = await registerStatementPackage(buildingId, {
      dispatchDate,
      files: files.map(({ name, size }) => ({ name, size })),
    })
    if (!registration.ok) {
      setProgress(null)
      return setError(registration.error)
    }

    const storage = createClient().storage.from(PDF_BUCKET)
    for (const [i, { path, token }] of registration.uploads.entries()) {
      setProgress(`Datei ${i + 1} von ${files.length} wird hochgeladen …`)
      const { error } = await storage.uploadToSignedUrl(path, token, files[i], {
        contentType: 'application/pdf',
      })
      if (error) {
        setProgress(null)
        return setError(
          `„${files[i].name}“ konnte nicht hochgeladen werden. Bitte versuchen Sie es erneut.`,
        )
      }
    }

    setProgress('Die Abrechnung wird ausgelesen …')
    startTransition(() => extractStatementPackage(registration.packageId))
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    upload(event.currentTarget).catch(() => {
      setProgress(null)
      setError('Beim Hochladen ist ein Fehler aufgetreten. Bitte versuchen Sie es erneut.')
    })
  }

  return (
    <form onSubmit={onSubmit} className="stack">
      <label>
        PDF-Dateien
        <span className="hint">
          Die Gesamtabrechnung und alle Einzelabrechnungen eines Abrechnungszeitraums.
        </span>
        <input type="file" name="files" accept="application/pdf,.pdf" multiple required disabled={busy} />
      </label>
      <label>
        Versanddatum
        <span className="hint">
          Wann die Einzelabrechnungen an die Mieter gehen (für die Frist nach §556 Abs. 3 BGB).
        </span>
        <input
          type="date"
          name="dispatchDate"
          defaultValue={defaultDispatchDate}
          required
          disabled={busy}
        />
      </label>
      {error && <p className="error" role="alert">{error}</p>}
      {progress && <p className="notice" role="status">{progress}</p>}
      <div>
        <button type="submit" disabled={busy}>Hochladen und auslesen</button>
      </div>
    </form>
  )
}
