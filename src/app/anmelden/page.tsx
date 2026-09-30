import Link from "next/link";
import { AuthForm } from "@/components/auth-form";
import { signIn } from "@/lib/auth/actions";

export const metadata = { title: "Anmelden – HeizCheck" };

export default async function SignInPage({ searchParams }: PageProps<"/anmelden">) {
  const { bestaetigung } = await searchParams;
  const initialError =
    bestaetigung === "fehlgeschlagen"
      ? "Der Bestätigungslink ist ungültig oder abgelaufen. Bitte melden Sie sich an oder registrieren Sie sich erneut."
      : undefined;

  return (
    <main className="mx-auto flex w-full max-w-sm flex-col gap-6 pt-12">
      <h1 className="text-2xl font-semibold">Bei HeizCheck anmelden</h1>
      <AuthForm
        action={signIn}
        submitLabel="Anmelden"
        initialError={initialError}
        fields={[
          { name: "email", label: "E-Mail-Adresse", type: "email", autoComplete: "email" },
          { name: "password", label: "Passwort", type: "password", autoComplete: "current-password" },
        ]}
      />
      <p className="text-sm">
        Noch kein Konto?{" "}
        <Link href="/registrieren" className="underline">
          Hausverwaltung registrieren
        </Link>
      </p>
    </main>
  );
}
