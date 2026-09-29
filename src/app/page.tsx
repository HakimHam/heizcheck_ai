import { redirect } from "next/navigation";
import { signOut } from "@/lib/auth/actions";
import { createClient } from "@/lib/supabase/server";

export default async function BuildingsPage() {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getClaims();
  if (!auth?.claims) redirect("/anmelden");

  // Row-level security limits both queries to the user's own Organisation.
  const [{ data: organisation }, { data: buildings, error }] = await Promise.all([
    supabase.from("organisations").select("name").single(),
    supabase.from("buildings").select("id, address").order("address"),
  ]);

  return (
    <>
      <header className="border-b border-border">
        <div className="mx-auto flex max-w-4xl items-center justify-between gap-4 px-4 py-3">
          <div>
            <p className="font-semibold">HeizCheck</p>
            {organisation && <p className="text-sm text-muted">{organisation.name}</p>}
          </div>
          <div className="flex items-center gap-4 text-sm">
            <span className="hidden text-muted sm:inline">{auth.claims.email}</span>
            <form action={signOut}>
              <button type="submit" className="rounded border border-border px-3 py-1.5">
                Abmelden
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8">
        <h1 className="mb-6 text-2xl font-semibold">Gebäude</h1>
        {error ? (
          <p role="alert" className="text-error">
            Die Gebäude konnten nicht geladen werden. Bitte laden Sie die Seite neu.
          </p>
        ) : buildings.length === 0 ? (
          <p className="rounded border border-dashed border-border px-4 py-8 text-center text-muted">
            Noch keine Gebäude angelegt.
          </p>
        ) : (
          <ul className="divide-y divide-border rounded border border-border">
            {buildings.map((b) => (
              <li key={b.id} className="px-4 py-3">
                {b.address}
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}
