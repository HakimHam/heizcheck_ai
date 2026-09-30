import Link from "next/link";
import { AuthForm } from "@/components/auth-form";
import { signUp } from "@/lib/auth/actions";

export const metadata = { title: "Registrieren – HeizCheck" };

export default function SignUpPage() {
  return (
    <main className="mx-auto flex w-full max-w-sm flex-col gap-6 pt-12">
      <h1 className="text-2xl font-semibold">Hausverwaltung registrieren</h1>
      <AuthForm
        action={signUp}
        submitLabel="Konto anlegen"
        fields={[
          { name: "organisationName", label: "Name der Hausverwaltung", type: "text", autoComplete: "organization" },
          { name: "email", label: "E-Mail-Adresse", type: "email", autoComplete: "email" },
          { name: "password", label: "Passwort (mindestens 8 Zeichen)", type: "password", autoComplete: "new-password" },
        ]}
      />
      <p className="text-sm">
        Bereits registriert?{" "}
        <Link href="/anmelden" className="underline">
          Anmelden
        </Link>
      </p>
    </main>
  );
}
