import 'server-only'
import { redirect } from 'next/navigation'
import { createClient } from './supabase/server'

// Server Actions can be called directly, so they check the session as well as
// the proxy. RLS then limits every write to the user's Organisation.
export async function requireSignedIn() {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  if (!data?.claims) redirect('/anmelden')
}
