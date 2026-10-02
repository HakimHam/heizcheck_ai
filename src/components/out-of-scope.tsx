export const OUT_OF_SCOPE_EXPLANATION =
  'HeizCheck prüft nur Wohngebäude. Für dieses Gebäude können keine Abrechnungen geprüft werden.'

export function OutOfScopeBanner() {
  return (
    <div className="banner banner-out-of-scope" role="note">
      <strong>Außerhalb des Prüfumfangs.</strong> {OUT_OF_SCOPE_EXPLANATION}
    </div>
  )
}

export function OutOfScopeBadge() {
  return (
    <span className="badge badge-out-of-scope" title={OUT_OF_SCOPE_EXPLANATION}>
      Außerhalb des Prüfumfangs
    </span>
  )
}
