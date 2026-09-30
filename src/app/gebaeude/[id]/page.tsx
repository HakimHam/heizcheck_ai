import Link from "next/link";
import { notFound } from "next/navigation";
import { AppHeader } from "@/components/app-header";
import { BuildingForm } from "@/components/building-form";
import { OutOfScopeNotice } from "@/components/building-scope";
import { requireUser } from "@/lib/auth/require-user";
import { updateBuilding } from "@/lib/buildings/actions";
import { toFormValues } from "@/lib/buildings/building-form";
import { BUILDING_COLUMNS, profileFromRow, unknownFacts, type BuildingRow } from "@/lib/buildings/building-profile";

export const metadata = { title: "Gebäude – HeizCheck" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function BuildingPage({ params, searchParams }: PageProps<"/gebaeude/[id]">) {
  const [{ id }, { angelegt }] = await Promise.all([params, searchParams]);
  const supabase = await requireUser();
  if (!UUID.test(id)) notFound();

  // Row-level security hides buildings of other Organisations, so they are simply not found.
  const { data: building, error } = await supabase
    .from("buildings")
    .select(BUILDING_COLUMNS)
    .eq("id", id)
    .maybeSingle<BuildingRow>();
  if (error) throw new Error(`Gebäude konnte nicht geladen werden: ${error.message}`);
  if (!building) notFound();

  const profile = profileFromRow(building);
  const missingFacts = unknownFacts(profile);

  return (
    <>
      <AppHeader />
      <main className="flex flex-col gap-4">
        <Link href="/" className="text-sm underline">
          ← Alle Gebäude
        </Link>
        <h1 className="text-2xl font-semibold">{building.address}</h1>
        {!profile.residential && <OutOfScopeNotice />}
        {profile.residential && missingFacts.length > 0 && (
          <p className="rounded border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
            Noch unbekannt: {missingFacts.join(", ")}. Ergänzen Sie diese Angaben, damit weniger Prüfungen als „nicht
            prüfbar“ enden.
          </p>
        )}
        <BuildingForm
          action={updateBuilding.bind(null, building.id)}
          submitLabel="Speichern"
          initialNotice={angelegt ? "Gebäude angelegt." : undefined}
          initialValues={toFormValues({ address: building.address, profile })}
        />
      </main>
    </>
  );
}
