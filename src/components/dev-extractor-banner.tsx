import { extractorMode, type ExtractorMode } from '@/lib/extractor/mode'

/**
 * Warns when extraction isn't the real production route: the fake Extractor
 * shows demo figures whatever the PDFs say, and the Anthropic API (USA) is for
 * development with synthetic or anonymised PDFs only (ADR 0003). A server
 * component: it reads the server's `EXTRACTOR`.
 */
export function DevExtractorBanner() {
  let mode: ExtractorMode
  try {
    mode = extractorMode()
  } catch {
    return null // A wrong EXTRACTOR fails the extraction itself, with its own message.
  }
  if (mode === 'fake') {
    return (
      <div className="banner banner-out-of-scope" role="alert">
        <strong>Demo-Modus:</strong> Die Werte sind Beispieldaten und werden nicht aus Ihren
        PDF-Dateien gelesen.
      </div>
    )
  }
  if (mode === 'anthropic') {
    return (
      <div className="banner banner-out-of-scope" role="alert">
        <strong>Entwicklungsmodus:</strong> Extraktion über Anthropic-API (USA) – keine echten
        Mieterdaten hochladen.
      </div>
    )
  }
  return null
}
