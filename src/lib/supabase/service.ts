import 'server-only'
import { createClient } from '@supabase/supabase-js'
import { supabaseEnv } from './env'

/**
 * A Supabase client acting as the service role, which bypasses RLS. Only the
 * retention job uses it; everything a Property Manager does runs as them
 * (`./server.ts`).
 */
export function createServiceClient() {
  const { url } = supabaseEnv()
  const secretKey = process.env.SUPABASE_SECRET_KEY
  if (!secretKey) throw new Error('SUPABASE_SECRET_KEY must be set (see .env.example).')
  return createClient(url, secretKey, { auth: { persistSession: false, autoRefreshToken: false } })
}
