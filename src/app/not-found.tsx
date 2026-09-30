import Link from "next/link";

export const metadata = { title: "Nicht gefunden – HeizCheck" };

/** Also shown for another Organisation's building: row-level security hides it, so it simply isn't found. */
export default function NotFound() {
  return (
    <main className="flex flex-col items-start gap-4 pt-12">
      <h1 className="text-2xl font-semibold">Seite nicht gefunden</h1>
      <p className="text-stone-600">Diese Seite gibt es nicht, oder Sie haben keinen Zugriff darauf.</p>
      <Link href="/" className="underline">
        Zur Gebäudeübersicht
      </Link>
    </main>
  );
}
