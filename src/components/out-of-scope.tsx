export const OUT_OF_SCOPE_EXPLANATION =
  'HeizCheck prüft nur Wohngebäude. Für dieses Gebäude können keine Abrechnungen geprüft werden.'

export function OutOfScopeBadge() {
  return (
    <span className="badge badge-out-of-scope" title={OUT_OF_SCOPE_EXPLANATION}>
      Außerhalb des Prüfumfangs
    </span>
  )
}
