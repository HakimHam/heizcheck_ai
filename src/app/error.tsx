"use client";

/** German fallback for unexpected errors; the server log holds the details under the digest. */
export default function ErrorPage({ error, retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return (
    <main className="flex flex-col items-start gap-4 pt-12">
      <h1 className="text-2xl font-semibold">Da ist etwas schiefgelaufen</h1>
      <p className="text-stone-600">
        Die Seite konnte nicht geladen werden. Bitte versuchen Sie es erneut.
        {error.digest && <> (Fehlerkennung: {error.digest})</>}
      </p>
      <button type="button" onClick={retry} className="rounded bg-stone-900 px-4 py-2 font-medium text-white">
        Erneut versuchen
      </button>
    </main>
  );
}
