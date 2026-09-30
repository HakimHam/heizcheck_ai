import { redirect } from "next/navigation";
import { signOut } from "@/lib/auth/actions";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Gebäude – HeizCheck" };

type Building = { id: string; address: string };

export default async function BuildingsPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  if (!data?.claims) redirect("/anmelden");

  // Row-level security limits both queries to the user's own Organisation.
  const [{ data: organisation }, { data: buildings, error }] = await Promise.all([
    supabase.from("organisations").select("name").single<{ name: string }>(),
    supabase.from("buildings").select("id, address").order("address").returns<Building[]>(),
  ]);
  if (error) throw new Error(`Gebäude konnten nicht geladen werden: ${error.message}`);

  return (
    <>
      <header className="mb-8 flex items-center justify-between gap-4">
        <div>
          <p className="text-lg font-semibold">HeizCheck</p>
          {organisation && <p className="text-sm text-stone-600">{organisation.name}</p>}
        </div>
        <form action={signOut}>
          <button type="submit" className="rounded border border-stone-300 bg-white px-3 py-1.5 text-sm">
            Abmelden
          </button>
        </form>
      </header>

      <main className="flex flex-col gap-4">
        <h1 className="text-2xl font-semibold">Gebäude</h1>
        {buildings.length === 0 ? (
          <p className="rounded border border-dashed border-stone-300 bg-white p-6 text-stone-600">
            Noch keine Gebäude angelegt.
          </p>
        ) : (
          <ul className="divide-y divide-stone-200 rounded border border-stone-200 bg-white">
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
