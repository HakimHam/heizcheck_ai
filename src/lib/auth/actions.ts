"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type AuthFormState = { error?: string; notice?: string };

const MIN_PASSWORD_LENGTH = 8;

// Supabase error codes, in German for the Property Manager.
const AUTH_ERRORS: Record<string, string> = {
  invalid_credentials: "E-Mail-Adresse oder Passwort ist falsch.",
  email_not_confirmed: "Bitte bestätigen Sie zuerst Ihre E-Mail-Adresse über den Link in unserer E-Mail.",
  user_already_exists: "Für diese E-Mail-Adresse gibt es bereits ein Konto. Bitte melden Sie sich an.",
  weak_password: `Das Passwort ist zu schwach. Bitte wählen Sie mindestens ${MIN_PASSWORD_LENGTH} Zeichen.`,
  over_request_rate_limit: "Zu viele Versuche. Bitte warten Sie einen Moment und versuchen Sie es erneut.",
  over_email_send_rate_limit: "Zu viele E-Mails angefordert. Bitte warten Sie einen Moment.",
};

const GENERIC_ERROR = "Das hat leider nicht geklappt. Bitte versuchen Sie es erneut.";

const germanError = (code: string | undefined) => (code && AUTH_ERRORS[code]) ?? GENERIC_ERROR;

const rawField = (formData: FormData, name: string) => String(formData.get(name) ?? "");
const field = (formData: FormData, name: string) => rawField(formData, name).trim();

/** The app's own origin, for links in e-mails. Falls back to the Host header when Origin is absent. */
async function siteOrigin(): Promise<string> {
  const h = await headers();
  const origin = h.get("origin");
  if (origin) return origin;
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const protocol = h.get("x-forwarded-proto") ?? "https";
  return `${protocol}://${host}`;
}

export async function signIn(_state: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const email = field(formData, "email");
  const password = rawField(formData, "password");
  if (!email || !password) return { error: "Bitte geben Sie E-Mail-Adresse und Passwort ein." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { error: germanError(error.code) };

  redirect("/");
}

export async function signUp(_state: AuthFormState, formData: FormData): Promise<AuthFormState> {
  const organisationName = field(formData, "organisationName");
  const email = field(formData, "email");
  const password = rawField(formData, "password");
  if (!organisationName) return { error: "Bitte geben Sie den Namen Ihrer Hausverwaltung ein." };
  if (!email) return { error: "Bitte geben Sie Ihre E-Mail-Adresse ein." };
  if (password.length < MIN_PASSWORD_LENGTH) return { error: AUTH_ERRORS.weak_password };

  const origin = await siteOrigin();
  const supabase = await createClient();
  // The on_auth_user_created trigger creates the Organisation from this metadata.
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { organisation_name: organisationName },
      emailRedirectTo: `${origin}/auth/callback`,
    },
  });
  if (error) return { error: germanError(error.code) };
  // With e-mail confirmation on, Supabase answers an already registered address with a user that has no identities.
  if (data.user?.identities?.length === 0) return { error: AUTH_ERRORS.user_already_exists };

  if (!data.session) {
    return { notice: "Fast geschafft: Bitte bestätigen Sie Ihre E-Mail-Adresse über den Link, den wir Ihnen geschickt haben." };
  }
  redirect("/");
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/anmelden");
}
