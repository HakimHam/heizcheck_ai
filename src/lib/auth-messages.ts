const ALREADY_REGISTERED =
  'Für diese E-Mail-Adresse gibt es bereits einen Zugang. Bitte melden Sie sich an.'
const RATE_LIMITED = 'Zu viele Versuche. Bitte warten Sie einige Minuten.'

// Supabase auth error codes (https://supabase.com/docs/guides/auth/debugging/error-codes),
// plus our own `confirmation_link_invalid` from /auth/callback.
const MESSAGES: Record<string, string> = {
  invalid_credentials: 'E-Mail-Adresse oder Passwort ist falsch.',
  email_not_confirmed: 'Bitte bestätigen Sie zuerst Ihre E-Mail-Adresse über den Link in unserer E-Mail.',
  user_already_exists: ALREADY_REGISTERED,
  email_exists: ALREADY_REGISTERED,
  weak_password: 'Das Passwort ist zu schwach. Bitte wählen Sie mindestens 8 Zeichen.',
  over_email_send_rate_limit: RATE_LIMITED,
  over_request_rate_limit: RATE_LIMITED,
  confirmation_link_invalid:
    'Der Bestätigungslink ist ungültig oder abgelaufen. Bitte melden Sie sich an oder registrieren Sie sich erneut.',
}

const FALLBACK = 'Das hat leider nicht geklappt. Bitte versuchen Sie es erneut.'

export function authErrorMessage(code: string | undefined): string {
  return (code && MESSAGES[code]) || FALLBACK
}
