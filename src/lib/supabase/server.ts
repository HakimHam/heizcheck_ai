import 'server-only'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { supabaseEnv } from './env'

/** A Supabase client acting as the signed-in user, so RLS applies. */
export async function createClient() {
  const cookieStore = await cookies()
  const { url, key } = supabaseEnv()

  return createServerClient(url, key, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options)
          }
        } catch {
          // Called from a Server Component, which can't set cookies. The proxy
          // refreshes the session instead.
        }
      },
    },
  })
}
