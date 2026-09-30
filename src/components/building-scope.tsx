export function OutOfScopeBadge() {
  return (
    <span className="rounded bg-red-100 px-2 py-0.5 text-xs font-medium text-red-800">Außerhalb des Prüfumfangs</span>
  );
}

export function IncompleteProfileBadge() {
  return (
    <span className="rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">
      Gebäudeprofil unvollständig
    </span>
  );
}

/** Why a non-residential building isn't checked. Upload itself is refused with ticket 03. */
export function OutOfScopeNotice() {
  return (
    <div role="alert" className="rounded border border-red-200 bg-red-50 p-4 text-sm text-red-900">
      <p className="font-semibold">Dieses Gebäude liegt außerhalb des Prüfumfangs.</p>
      <p>
        HeizCheck prüft nur Wohngebäude. Für Nichtwohngebäude und gemischt genutzte Gebäude gelten andere Regeln
        (z. B. die hälftige Aufteilung nach § 8 CO2KostAufG), die HeizCheck nicht abdeckt. Abrechnungspakete für
        dieses Gebäude können daher nicht geprüft werden.
      </p>
    </div>
  );
}
