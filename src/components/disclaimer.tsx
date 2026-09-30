/** Shown on every screen: what HeizCheck does and does not promise. */
export function Disclaimer() {
  return (
    <p role="note" className="text-sm text-stone-600">
      <strong className="font-semibold">Hinweis:</strong> HeizCheck prüft Heizkostenabrechnungen belegbasiert anhand
      der abgelesenen Zahlen und der geltenden Vorschriften. Das Ergebnis ist keine Garantie für die rechtliche
      Richtigkeit der Abrechnung und ersetzt keine Rechtsberatung.
    </p>
  );
}
