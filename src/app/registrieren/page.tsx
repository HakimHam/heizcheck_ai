import type { Metadata } from "next";
import { AuthForm } from "@/components/auth-form";
import { signUp } from "@/lib/auth/actions";

export const metadata: Metadata = { title: "Registrieren – HeizCheck" };

export default function SignUpPage() {
  return (
    <main className="mx-auto w-full max-w-sm flex-1 px-4 py-12">
      <h1 className="mb-2 text-2xl font-semibold">Registrieren</h1>
      <p className="mb-6 text-sm text-muted">
        Registrieren Sie Ihre Hausverwaltung bei HeizCheck. Alle Kolleginnen und Kollegen Ihrer Hausverwaltung
        haben später dieselben Rechte.
      </p>
      <AuthForm
        action={signUp}
        submitLabel="Registrieren"
        fields={[
          { name: "organisationName", label: "Name der Hausverwaltung", type: "text", autoComplete: "organization" },
          { name: "email", label: "E-Mail-Adresse", type: "email", autoComplete: "email" },
          { name: "password", label: "Passwort", type: "password", autoComplete: "new-password" },
        ]}
        alternative={{ text: "Bereits registriert?", linkLabel: "Zur Anmeldung", href: "/anmelden" }}
      />
    </main>
  );
}
