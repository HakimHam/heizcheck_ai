import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// The signed-in user and their Organisation, as the route's Supabase client sees them.
const supabase = vi.hoisted(() => ({
  claims: null as null | { sub: string; email: string },
  auth: { getClaims: vi.fn() },
  from: vi.fn(),
}))
vi.mock('@/lib/supabase/server', () => ({ createClient: async () => supabase }))

const { POST } = await import('./route')

const WEBHOOK = 'https://n8n.test/webhook/hilfe'
const n8n = vi.fn()

const call = (body: string) =>
  POST(new Request('https://heizcheck.test/api/hilfe', { method: 'POST', body, headers: { 'Content-Type': 'application/json' } }))

beforeEach(() => {
  vi.stubEnv('N8N_HELP_WEBHOOK_URL', WEBHOOK)
  vi.stubEnv('N8N_HELP_WEBHOOK_SECRET', 'n8n-secret-with-enough-entropy')
  vi.stubGlobal('fetch', n8n)
  supabase.claims = { sub: '0b6c1f8e-3d4a-4f6b-9c2d-1e2f3a4b5c6d', email: 'pm@hausverwaltung.de' }
  supabase.auth.getClaims.mockImplementation(async () => ({ data: supabase.claims ? { claims: supabase.claims } : null }))
  supabase.from.mockImplementation(() => ({
    select: () => ({ maybeSingle: async () => ({ data: { name: 'Muster Hausverwaltung GmbH' }, error: null }) }),
  }))
  n8n.mockResolvedValue(Response.json({ category: 'konto_zugang', summary: 'Kollegin einladen.' }))
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.unstubAllGlobals()
  n8n.mockReset()
})

describe('POST /api/hilfe', () => {
  it('forwards a signed-in user’s message to n8n and returns the category', async () => {
    const response = await call(JSON.stringify({ message: 'Wie lade ich eine Kollegin ein?', pagePath: '/' }))

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ outcome: 'classified', label: 'Konto & Zugang' })
    expect(response.headers.get('Cache-Control')).toBe('no-store')
    const [url, init] = n8n.mock.calls[0]
    expect(url).toBe(WEBHOOK)
    expect(JSON.parse(init.body)).toMatchObject({
      message: 'Wie lade ich eine Kollegin ein?',
      user: { id: '0b6c1f8e-3d4a-4f6b-9c2d-1e2f3a4b5c6d', email: 'pm@hausverwaltung.de' },
      organisationName: 'Muster Hausverwaltung GmbH',
      requestId: expect.stringMatching(/^[0-9a-f-]{36}$/),
    })
  })

  it('refuses anyone who is not signed in, without calling n8n', async () => {
    supabase.claims = null
    const response = await call(JSON.stringify({ message: 'Hilfe', pagePath: '/' }))
    expect(response.status).toBe(401)
    expect(n8n).not.toHaveBeenCalled()
  })

  it('answers 400 to a body that is not JSON, without calling n8n', async () => {
    const response = await call('not json')
    expect(response.status).toBe(400)
    expect(await response.json()).toMatchObject({ outcome: 'invalid' })
    expect(n8n).not.toHaveBeenCalled()
  })

  it('does not exist while the help chat is off (ADR 0004)', async () => {
    vi.stubEnv('N8N_HELP_WEBHOOK_URL', '')
    const response = await call(JSON.stringify({ message: 'Hilfe', pagePath: '/' }))
    expect(response.status).toBe(404)
    expect(n8n).not.toHaveBeenCalled()
  })
})
