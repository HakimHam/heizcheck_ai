'use client'

import type { PDFDocumentLoadingTask, RenderTask } from 'pdfjs-dist'
import { useEffect, useRef, useState } from 'react'
import type { SourceReference } from '@/lib/figures'
import type { PdfLink } from '@/lib/statement-packages'

/** A selected figure's source, or null when it has none. A new object for every selection. */
export type Selection = { source: SourceReference | null }

type Props = { files: PdfLink[]; selection: Selection | undefined }

/** The PDF and 1-based page in view. */
type View = { file: number; page: number }

// pdf.js is loaded on first use, in the browser only.
let pdfjs: Promise<typeof import('pdfjs-dist')> | undefined

function loadPdfjs() {
  pdfjs ??= import('pdfjs-dist').then((lib) => {
    lib.GlobalWorkerOptions.workerPort = new Worker(
      new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url),
      { type: 'module' },
    )
    return lib
  })
  return pdfjs
}

/** The package's PDFs, one page at a time, with the selected figure's region highlighted. */
export function PdfSourceViewer({ files, selection }: Props) {
  const [view, setView] = useState<View>({ file: 0, page: 1 })
  const [pageCount, setPageCount] = useState<number | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const canvas = useRef<HTMLCanvasElement>(null)
  const scroller = useRef<HTMLDivElement>(null)
  const highlight = useRef<HTMLDivElement>(null)
  // This viewer's open PDFs by link, released when it goes.
  const documents = useRef(new Map<string, Promise<PDFDocumentLoadingTask>>())

  const source = selection?.source
  // The source's PDF, by file name; the first one if several share it.
  const sourceFile = source ? files.findIndex((f) => f.fileName === source.file) : -1

  const [followed, setFollowed] = useState(selection)
  if (selection !== followed) {
    setFollowed(selection)
    if (source && sourceFile >= 0) {
      if (sourceFile !== view.file) setPageCount(null)
      setView({ file: sourceFile, page: source.page })
    }
  }

  const file = files[view.file]
  const highlighted =
    source && sourceFile === view.file && source.page === view.page && !loadError ? source : null

  useEffect(() => {
    const open = documents.current
    return () => {
      for (const loading of open.values()) loading.then((task) => task.destroy(), () => {})
      open.clear()
    }
  }, [])

  useEffect(() => {
    if (!file || !canvas.current) return
    const target = canvas.current
    const open = documents.current
    let cancelled = false
    let task: RenderTask | undefined
    setLoadError(null)

    let loading = open.get(file.url)
    if (!loading) {
      loading = loadPdfjs().then((lib) => lib.getDocument({ url: file.url }))
      open.set(file.url, loading)
    }
    loading
      .then((loadingTask) => loadingTask.promise)
      .then(async (pdf) => {
        if (cancelled) return
        setPageCount(pdf.numPages)
        if (view.page > pdf.numPages) {
          setLoadError(`Seite ${view.page} gibt es in dieser Datei nicht (${pdf.numPages} Seiten).`)
          return
        }
        const page = await pdf.getPage(view.page)
        if (cancelled) return
        const width = target.parentElement?.clientWidth || 600
        const scale = (width / page.getViewport({ scale: 1 }).width) * (window.devicePixelRatio || 1)
        const viewport = page.getViewport({ scale })
        target.width = Math.floor(viewport.width)
        target.height = Math.floor(viewport.height)
        task = page.render({ canvas: target, viewport })
        await task.promise
        if (!cancelled) scrollToHighlight()
      })
      .catch((error: unknown) => {
        if (cancelled || (error instanceof Error && error.name === 'RenderingCancelledException')) return
        console.error('Showing a PDF failed', error)
        // A failed load (e.g. an expired link) is tried again when the PDF is shown again.
        open.delete(file.url)
        setLoadError('Die PDF-Datei konnte nicht angezeigt werden. Bitte laden Sie die Seite neu.')
      })
    return () => {
      cancelled = true
      task?.cancel()
    }
  }, [file, view.page])

  // Another region on the page already shown.
  useEffect(scrollToHighlight, [highlighted])

  function scrollToHighlight() {
    if (highlight.current && scroller.current) {
      scroller.current.scrollTop = highlight.current.offsetTop - scroller.current.clientHeight / 3
    }
  }

  if (!file) {
    return <aside className="pdf-viewer"><p className="muted">Keine PDF-Dateien vorhanden.</p></aside>
  }

  const goToPage = (page: number) => setView((v) => ({ ...v, page }))

  return (
    <aside className="pdf-viewer" aria-label="PDF-Ansicht">
      <div className="pdf-toolbar">
        {files.length > 1 ? (
          <select
            aria-label="PDF-Datei"
            value={view.file}
            onChange={(e) => {
              setPageCount(null)
              setView({ file: Number(e.target.value), page: 1 })
            }}
          >
            {files.map((f, i) => (
              <option key={f.position} value={i}>{f.fileName}</option>
            ))}
          </select>
        ) : (
          <span className="pdf-file">{file.fileName}</span>
        )}
        <span className="pdf-pages">
          <button type="button" className="secondary" disabled={view.page <= 1} onClick={() => goToPage(view.page - 1)} aria-label="Vorherige Seite">‹</button>
          Seite {view.page}{pageCount !== null && ` von ${pageCount}`}
          <button type="button" className="secondary" disabled={pageCount !== null && view.page >= pageCount} onClick={() => goToPage(view.page + 1)} aria-label="Nächste Seite">›</button>
        </span>
      </div>
      <p className="pdf-status" role="status">
        {sourceStatus(selection, sourceFile >= 0, highlighted !== null)}
      </p>
      <div className="pdf-scroll" ref={scroller}>
        {loadError && <p className="error">{loadError}</p>}
        <div className="pdf-page" hidden={Boolean(loadError)}>
          <canvas ref={canvas} />
          {highlighted && (
            <div
              ref={highlight}
              className="pdf-highlight"
              style={{
                left: `${highlighted.bbox[0] * 100}%`,
                top: `${highlighted.bbox[1] * 100}%`,
                width: `${highlighted.bbox[2] * 100}%`,
                height: `${highlighted.bbox[3] * 100}%`,
              }}
            />
          )}
        </div>
      </div>
    </aside>
  )
}

function sourceStatus(selection: Selection | undefined, inPackage: boolean, highlighted: boolean) {
  if (!selection) return 'Wählen Sie einen Wert, um seine Fundstelle zu sehen.'
  const { source } = selection
  if (!source) return 'Für diesen Wert gibt es keine Fundstelle in den PDF-Dateien.'
  if (!inPackage) return `Die Fundstelle liegt in „${source.file}“, die nicht zum Paket gehört.`
  if (highlighted) return 'Die Fundstelle ist markiert.'
  return `Fundstelle: ${source.file}, Seite ${source.page}.`
}
