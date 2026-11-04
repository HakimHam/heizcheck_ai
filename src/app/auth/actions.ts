'use server'

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { authErrorMessage } from '@/lib/auth-messages'
import { createClient } from '@/lib/supabase/server'

export type AuthFormState = { error?: string; notice?: string }

const credentials = (form: FormData) => ({
  email: String(form.get('email') ?? '').trim(),
  password: String(form.get('password') ?? ''),
})

async function appOrigin() {
  const h = await headers()
  const origin = h.get('origin')
  if (origin) return origin
  const host = h.get('x-forwarded-host') ?? h.get('host')
  return `${h.get('x-forwarded-proto') ?? 'https'}://${host}`
}

export async function signIn(_: AuthFormState, form: FormData): Promise<AuthFormState> {
  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword(credentials(form))
  if (error) return { error: authErrorMessage(error.code) }
  redirect('/')
}

export async function signUp(_: AuthFormState, form: FormData): Promise<AuthFormState> {
  const organisationName = String(form.get('organisation') ?? '').trim()
  if (!organisationName) return { error: 'Bitte geben Sie den Namen Ihrer Hausverwaltung an.' }

  const supabase = await createClient()
  const { data, error } = await supabase.auth.signUp({
    ...credentials(form),
    options: {
      // Read by the sign-up trigger, which creates the Organisation.
      data: { organisation_name: organisationName },
      emailRedirectTo: `${await appOrigin()}/auth/callback`,
    },
  })
  if (error) return { error: authErrorMessage(error.code) }
  if (data.session) redirect('/')
  return {
    notice: 'Fast geschafft: Bitte bestätigen Sie Ihre E-Mail-Adresse über den Link, den wir Ihnen geschickt haben.',
  }
}

export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect('/anmelden')
}
