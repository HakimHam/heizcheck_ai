import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// The job's database and storage, as the route's service client sees them.
const client = vi.hoisted(() => ({
  rpc: vi.fn(),
  storage: { from: () => ({ remove: vi.fn(async () => ({ error: null })) }) },
}))
vi.mock('@/lib/supabase/service', () => ({ createServiceClient: () => client }))

const { GET } = await import('./route')

const SECRET = 'cron-secret-with-enough-entropy'
const call = (authorization?: string) =>
  GET(new Request('https://heizcheck.test/api/retention', { headers: authorization ? { authorization } : {} }))

beforeEach(() => {
  vi.stubEnv('CRON_SECRET', SECRET)
  vi.spyOn(console, 'info').mockImplementation(() => {})
  vi.spyOn(console, 'error').mockImplementation(() => {})
  client.rpc.mockImplementation(async (fn: string) =>
    fn === 'expired_statement_package_files' ? { data: ['org/a/1.pdf'], error: null } : { data: 1, error: null },
  )
})

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
  client.rpc.mockReset()
})

describe('GET /api/retention', () => {
  it('runs the job for Vercel Cron and reports what it deleted', async () => {
    const response = await call(`Bearer ${SECRET}`)
    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ removedFiles: 1, deletedPackages: 1 })
    expect(response.headers.get('Cache-Control')).toBe('no-store')
  })

  it('refuses anyone without the cron secret, and deletes nothing', async () => {
    for (const authorization of [undefined, 'Bearer wrong']) {
      const response = await call(authorization)
      expect(response.status).toBe(401)
      expect(response.headers.get('Cache-Control')).toBe('no-store')
    }
    expect(client.rpc).not.toHaveBeenCalled()
  })

  it('answers 500 without details when the job fails', async () => {
    client.rpc.mockResolvedValue({ data: null, error: { message: 'permission denied for function' } })
    const response = await call(`Bearer ${SECRET}`)
    expect(response.status).toBe(500)
    expect(await response.json()).toEqual({ error: 'Retention job failed' })
    expect(response.headers.get('Cache-Control')).toBe('no-store')
  })
})
