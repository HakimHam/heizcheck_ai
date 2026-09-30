import Link from "next/link";
import { AppHeader } from "@/components/app-header";
import { IncompleteProfileBadge, OutOfScopeBadge } from "@/components/building-scope";
import { requireUser } from "@/lib/auth/require-user";
import { BUILDING_COLUMNS, profileFromRow, unknownFacts, type BuildingRow } from "@/lib/buildings/building-profile";

export const metadata = { title: "Gebäude – HeizCheck" };

export default async function BuildingsPage() {
  const supabase = await requireUser();

  // Row-level security limits the query to the user's own Organisation.
  const { data: buildings, error } = await supabase
    .from("buildings")
    .select(BUILDING_COLUMNS)
    .order("address")
    .returns<BuildingRow[]>();
  if (error) throw new Error(`Gebäude konnten nicht geladen werden: ${error.message}`);

  return (
    <>
      <AppHeader />

      <main className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-4">
          <h1 className="text-2xl font-semibold">Gebäude</h1>
          <Link href="/gebaeude/neu" className="rounded bg-stone-900 px-4 py-2 text-sm font-medium text-white">
            Gebäude anlegen
          </Link>
        </div>
        {buildings.length === 0 ? (
          <p className="rounded border border-dashed border-stone-300 bg-white p-6 text-stone-600">
            Noch keine Gebäude angelegt.
          </p>
        ) : (
          <table className="w-full rounded border border-stone-200 bg-white text-left text-sm">
            <thead className="border-b border-stone-200 text-stone-600">
              <tr>
                <th className="px-4 py-2 font-medium">Adresse</th>
                <th className="px-4 py-2 font-medium">Abrechnungszeiträume</th>
                <th className="px-4 py-2 font-medium">Letzter Prüfbericht</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-200">
              {buildings.map((b) => {
                const profile = profileFromRow(b);
                return (
                  <tr key={b.id}>
                    <td className="px-4 py-3">
                      <Link href={`/gebaeude/${b.id}`} className="font-medium underline">
                        {b.address}
                      </Link>
                      <div className="mt-1 flex flex-wrap gap-2">
                        {!profile.residential && <OutOfScopeBadge />}
                        {profile.residential && unknownFacts(profile).length > 0 && <IncompleteProfileBadge />}
                      </div>
                    </td>
                    {/* Statement Packages and Check Reports arrive with ticket 03. */}
                    <td className="px-4 py-3 text-stone-600">Noch keine</td>
                    <td className="px-4 py-3 text-stone-600">–</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </main>
    </>
  );
}
