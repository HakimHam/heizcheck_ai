export const DISCLAIMER =
  "HeizCheck bietet eine belegbasierte Prüfung von Heizkostenabrechnungen, aber keine Garantie für deren rechtliche Richtigkeit. Die Prüfung ersetzt keine Rechtsberatung.";

export function Disclaimer() {
  return (
    <footer className="border-t border-border bg-surface px-4 py-4 text-sm text-muted">
      <p className="mx-auto max-w-4xl">
        <strong className="font-semibold text-foreground">Hinweis:</strong> {DISCLAIMER}
      </p>
    </footer>
  );
}
