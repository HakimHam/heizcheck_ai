/**
 * Warns while extraction runs over the Anthropic API (USA), which is for
 * development with synthetic or anonymised PDFs only (ADR 0003). A server
 * component: it reads the server's `EXTRACTOR`.
 */
export function DevExtractorBanner() {
  if (process.env.EXTRACTOR !== 'anthropic') return null
  return (
    <div className="banner banner-out-of-scope" role="alert">
      <strong>Entwicklungsmodus:</strong> Extraktion über Anthropic-API (USA) – keine echten
      Mieterdaten hochladen.
    </div>
  )
}
