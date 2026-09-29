import type { Metadata } from "next";
import { AuthForm } from "@/components/auth-form";
import { signIn } from "@/lib/auth/actions";

export const metadata: Metadata = { title: "Anmelden – HeizCheck" };

export default async function SignInPage({ searchParams }: PageProps<"/anmelden">) {
  const { fehler } = await searchParams;

  return (
    <main className="mx-auto w-full max-w-sm flex-1 px-4 py-12">
      <h1 className="mb-6 text-2xl font-semibold">Anmelden</h1>
      <AuthForm
        action={signIn}
        submitLabel="Anmelden"
        initialError={
          fehler === "bestaetigung"
            ? "Der Bestätigungslink ist ungültig oder abgelaufen. Bitte melden Sie sich an oder registrieren Sie sich erneut."
            : undefined
        }
        fields={[
          { name: "email", label: "E-Mail-Adresse", type: "email", autoComplete: "email" },
          { name: "password", label: "Passwort", type: "password", autoComplete: "current-password" },
        ]}
        alternative={{ text: "Noch nicht registriert?", linkLabel: "Jetzt registrieren", href: "/registrieren" }}
      />
    </main>
  );
}
