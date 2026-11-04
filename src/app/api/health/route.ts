import { checkHealth } from '@/lib/health'

// Never a cached answer: a health check must reflect this moment.
export const dynamic = 'force-dynamic'

// Public, for the post-deploy smoke test and the uptime check. 503 when unhealthy.
export async function GET() {
  const health = await checkHealth()
  return Response.json(health, { status: health.ok ? 200 : 503, headers: { 'Cache-Control': 'no-store' } })
}
