import Link from "next/link";
import { AppHeader } from "@/components/app-header";
import { BuildingForm } from "@/components/building-form";
import { requireUser } from "@/lib/auth/require-user";
import { createBuilding } from "@/lib/buildings/actions";
import { toFormValues } from "@/lib/buildings/building-form";

export const metadata = { title: "Gebäude anlegen – HeizCheck" };

export default async function NewBuildingPage() {
  await requireUser();

  return (
    <>
      <AppHeader />
      <main className="flex flex-col gap-4">
        <Link href="/" className="text-sm underline">
          ← Alle Gebäude
        </Link>
        <h1 className="text-2xl font-semibold">Gebäude anlegen</h1>
        <BuildingForm
          action={createBuilding}
          submitLabel="Gebäude anlegen"
          initialValues={toFormValues(null)}
        />
      </main>
    </>
  );
}
