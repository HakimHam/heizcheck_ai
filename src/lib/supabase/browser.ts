import { createBrowserClient } from '@supabase/ssr'
import { supabaseEnv } from './env'

/** A Supabase client in the browser, signed in through the session cookie. */
export const createClient = () => {
  const { url, key } = supabaseEnv()
  return createBrowserClient(url, key)
}
