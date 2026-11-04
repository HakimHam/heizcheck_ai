import { type Env, type ExtractorMode, extractorMode } from './extractor/mode'

// What /api/health reports: is this deployment configured and can it reach
// Supabase? The post-deploy smoke test and the uptime check call it. It names
// no secret, only which build runs and which Extractor reads PDFs.

export type Health = {
  ok: boolean
  /** VERCEL_ENV (production, preview, development), or local outside Vercel. */
  environment: string
  /** The deployed Git commit, short. */
  commit: string | null
  extractor: ExtractorMode | null
  checks: { config: string; supabase: string }
}

type Fetch = (url: string, init?: RequestInit) => Promise<Response>

const TIMEOUT_MS = 5000

export async function checkHealth(env: Env = process.env, fetcher: Fetch = fetch): Promise<Health> {
  const environment = env.VERCEL_ENV || 'local'
  const commit = env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null
  const url = env.NEXT_PUBLIC_SUPABASE_URL
  const key = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

  let extractor: ExtractorMode | null = null
  let config = 'ok'
  try {
    extractor = extractorMode(env)
  } catch {
    config = 'EXTRACTOR is invalid'
  }
  if (!url || !key) config = 'Supabase URL or key missing'
  else if (extractor === 'anthropic' && environment === 'production') {
    config = 'EXTRACTOR=anthropic is refused in production'
  } else if (extractor === 'anthropic' && !env.ANTHROPIC_API_KEY) config = 'ANTHROPIC_API_KEY missing'

  let supabase = 'not checked'
  if (url && key) {
    try {
      const response = await fetcher(`${url}/auth/v1/health`, {
        headers: { apikey: key },
        signal: AbortSignal.timeout(TIMEOUT_MS),
        cache: 'no-store',
      })
      supabase = response.ok ? 'ok' : `HTTP ${response.status}`
    } catch {
      supabase = 'unreachable'
    }
  }

  return { ok: config === 'ok' && supabase === 'ok', environment, commit, extractor, checks: { config, supabase } }
}
