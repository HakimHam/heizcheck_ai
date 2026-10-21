import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// The signed-in user, as the route's Supabase client sees them.
const supabase = vi.hoisted(() => ({
  claims: null as null | { sub: string },
  auth: { getClaims: vi.fn() },
}))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => supabase }))

// Claude, faked: the route must use the knowledge base on disk and this model.
const send = vi.hoisted(() => vi.fn())
vi.mock('@/lib/explain-chat/anthropic-model', () => ({
  anthropicExplainModel: () => ({ model: 'claude-haiku-5-5', send }),
}))

const { POST } = await import('./route')

const call = (body: string) =>
  POST(new Request('https://heizcheck.test/api/erklaerung', { method: 'POST', body, headers: { 'Content-Type': 'application/json' } }))

beforeEach(() => {
  vi.stubEnv('EXPLAIN_CHAT_ENABLED', 'true')
  vi.stubEnv('VERCEL_ENV', '')
  supabase.claims = { sub: '0b6c1f8e-3d4a-4f6b-9c2d-1e2f3a4b5c6d' }
  supabase.auth.getClaims.mockImplementation(async () => ({ data: supabase.claims ? { claims: supabase.claims } : null }))
  send.mockResolvedValue({
    content: [{ type: 'text', text: 'Die Abrechnung muss den Mietern binnen 12 Monaten zugehen (§556 Abs. 3 BGB).' }],
  })
})

afterEach(() => {
  vi.unstubAllEnvs()
  send.mockReset()
})

describe('POST /api/erklaerung', () => {
  it('answers a signed-in user’s question from the knowledge base, with sources', async () => {
    const response = await call(JSON.stringify({ ruleId: 'B1', question: 'Was bedeutet dieser Befund?' }))

    expect(response.status).toBe(200)
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    const answer = await response.json()
    expect(answer.outcome).toBe('answered')
    expect(answer.sources[0]).toEqual({ file: 'abrechnungsfrist.md', heading: 'B1 – Abrechnungsfrist' })
    // The real B1 section from knowledge/ went into the prompt.
    expect(JSON.stringify(send.mock.calls[0][0].messages)).toContain('12 Kalendermonate')
  })

  it('refuses anyone who is not signed in, without calling Claude', async () => {
    supabase.claims = null
    const response = await call(JSON.stringify({ ruleId: 'B1', question: 'Was tun?' }))
    expect(response.status).toBe(401)
    expect(send).not.toHaveBeenCalled()
  })

  it('answers 400 to a body that is not JSON, without calling Claude', async () => {
    const response = await call('not json')
    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ outcome: 'invalid' })
    expect(send).not.toHaveBeenCalled()
  })

  it('answers off-topic questions with the fallback, without calling Claude', async () => {
    const response = await call(JSON.stringify({ question: 'Wie heißt der Geschäftsführer von HeizCheck?' }))
    expect(await response.json()).toMatchObject({ outcome: 'no_context' })
    expect(send).not.toHaveBeenCalled()
  })

  it('does not exist while the explain chat is off (ADR 0005)', async () => {
    vi.stubEnv('EXPLAIN_CHAT_ENABLED', '')
    const response = await call(JSON.stringify({ ruleId: 'B1', question: 'Was tun?' }))
    expect(response.status).toBe(404)
    expect(send).not.toHaveBeenCalled()
  })

  it('does not exist on Vercel production, even with the flag set', async () => {
    vi.stubEnv('VERCEL_ENV', 'production')
    const response = await call(JSON.stringify({ ruleId: 'B1', question: 'Was tun?' }))
    expect(response.status).toBe(404)
  })

  it('answers on Vercel production once EXPLAIN_CHAT_IN_PRODUCTION is set (demo opt-in)', async () => {
    vi.stubEnv('VERCEL_ENV', 'production')
    vi.stubEnv('EXPLAIN_CHAT_IN_PRODUCTION', 'true')
    const response = await call(JSON.stringify({ ruleId: 'B1', question: 'Was tun?' }))
    expect(response.status).toBe(200)
  })
})
