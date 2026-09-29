"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type AuthFormState = { error?: string; message?: string };

/** German messages for the Supabase auth error codes a user can act on. */
const authErrorMessages: Record<string, string> = {
  email_not_confirmed:
    "Bitte bestätigen Sie zuerst Ihre E-Mail-Adresse über den Link, den wir Ihnen geschickt haben.",
  invalid_credentials: "Anmeldung fehlgeschlagen. Bitte prüfen Sie E-Mail-Adresse und Passwort.",
  weak_password: "Das Passwort ist zu schwach. Bitte wählen Sie ein längeres Passwort.",
  user_already_exists: "Zu dieser E-Mail-Adresse ist bereits eine Anmeldung registriert.",
};

function authError(code: string | undefined, fallback: string): AuthFormState {
  return { error: (code && authErrorMessages[code]) || fallback };
}

function field(formData: FormData, name: string) {
  return String(formData.get(name) ?? "");
}

/** The app's own origin, for links in e-mails. Behind Vercel the forwarded headers are set. */
async function appOrigin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto = h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}

export async function signIn(_state: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: field(formData, "email").trim(),
    password: field(formData, "password"),
  });

  if (error) return authError(error.code, authErrorMessages.invalid_credentials);
  redirect("/");
}

export async function signUp(_state: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const organisationName = field(formData, "organisationName").trim();
  if (!organisationName) {
    return { error: "Bitte geben Sie den Namen Ihrer Hausverwaltung an." };
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: field(formData, "email").trim(),
    password: field(formData, "password"),
    options: {
      // Read by the on_auth_user_created trigger, which creates the Organisation.
      data: { organisation_name: organisationName },
      emailRedirectTo: `${await appOrigin()}/auth/callback`,
    },
  });

  if (error) return authError(error.code, "Registrierung fehlgeschlagen. Bitte versuchen Sie es erneut.");
  if (data.session) redirect("/");
  return {
    message:
      "Fast geschafft: Bitte bestätigen Sie Ihre E-Mail-Adresse über den Link, den wir Ihnen geschickt haben.",
  };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/anmelden");
}
