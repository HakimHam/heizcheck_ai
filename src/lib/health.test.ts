import { describe, expect, it } from 'vitest'
import { checkHealth } from './health'

const env = {
  NEXT_PUBLIC_SUPABASE_URL: 'https://ref.supabase.co',
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_x',
  VERCEL_ENV: 'preview',
  VERCEL_GIT_COMMIT_SHA: 'abc1234def',
  EXTRACTOR: 'anthropic',
  ANTHROPIC_API_KEY: 'sk-ant-secret',
}

const answering = (status: number) => {
  const calls: { url: string; headers: Record<string, string> }[] = []
  const fetch = async (url: string, init?: RequestInit) => {
    calls.push({ url, headers: init?.headers as Record<string, string> })
    return new Response(null, { status })
  }
  return { fetch, calls }
}

describe('the health check', () => {
  it('is ok when Supabase answers, and says which build and Extractor run', async () => {
    const { fetch, calls } = answering(200)
    const health = await checkHealth(env, fetch)
    expect(health).toEqual({
      ok: true,
      environment: 'preview',
      commit: 'abc1234',
      extractor: 'anthropic',
      checks: { config: 'ok', supabase: 'ok' },
    })
    expect(calls[0].url).toBe('https://ref.supabase.co/auth/v1/health')
    expect(calls[0].headers.apikey).toBe('sb_publishable_x')
  })

  it('never reveals a secret', async () => {
    const health = await checkHealth(env, answering(200).fetch)
    expect(JSON.stringify(health)).not.toMatch(/sk-ant|sb_publishable/)
  })

  it('fails when Supabase answers with an error or not at all', async () => {
    expect(await checkHealth(env, answering(503).fetch)).toMatchObject({ ok: false, checks: { supabase: 'HTTP 503' } })
    const down = async () => {
      throw new Error('ECONNREFUSED')
    }
    expect(await checkHealth(env, down)).toMatchObject({ ok: false, checks: { supabase: 'unreachable' } })
  })

  it('fails without calling Supabase when the configuration is broken', async () => {
    const { fetch, calls } = answering(200)
    const health = await checkHealth({ ...env, NEXT_PUBLIC_SUPABASE_URL: undefined }, fetch)
    expect(health).toMatchObject({ ok: false, checks: { config: 'Supabase URL or key missing' } })
    expect(calls).toHaveLength(0)

    const bad = await checkHealth({ ...env, EXTRACTOR: 'claude' }, fetch)
    expect(bad).toMatchObject({ ok: false, extractor: null, checks: { config: 'EXTRACTOR is invalid' } })
  })

  it('fails when the Anthropic route is configured for production (ADR 0003)', async () => {
    const health = await checkHealth({ ...env, VERCEL_ENV: 'production' }, answering(200).fetch)
    expect(health).toMatchObject({ ok: false, checks: { config: 'EXTRACTOR=anthropic is refused in production' } })
  })

  it('fails when the Anthropic route has no API key', async () => {
    const health = await checkHealth({ ...env, ANTHROPIC_API_KEY: '' }, answering(200).fetch)
    expect(health).toMatchObject({ ok: false, checks: { config: 'ANTHROPIC_API_KEY missing' } })
  })

  it('runs locally, outside Vercel', async () => {
    const health = await checkHealth({ ...env, VERCEL_ENV: undefined, VERCEL_GIT_COMMIT_SHA: undefined }, answering(200).fetch)
    expect(health).toMatchObject({ ok: true, environment: 'local', commit: null })
  })
})
