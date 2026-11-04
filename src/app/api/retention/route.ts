import { isAuthorisedCron, runRetention } from '@/lib/retention'
import { supabaseRetentionStore } from '@/lib/retention-store'
import { createServiceClient } from '@/lib/supabase/service'

// Never a cached answer: every call is a run of the job.
export const dynamic = 'force-dynamic'

const NO_STORE = { 'Cache-Control': 'no-store' }

/**
 * Runs the retention job: deletes Statement Packages, their PDFs and their
 * Check Reports 4 years after they were created (§556 para 3 sentence 5 BGB
 * plus §195 BGB; see src/lib/retention.ts). Vercel Cron calls it daily
 * (vercel.json) with the CRON_SECRET; anyone else gets 401.
 */
export async function GET(request: Request) {
  if (!isAuthorisedCron(request.headers.get('authorization'), process.env.CRON_SECRET)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE })
  }
  try {
    const result = await runRetention(supabaseRetentionStore(createServiceClient()), new Date())
    console.info('Retention job', result)
    return Response.json(result, { headers: NO_STORE })
  } catch (error) {
    // A failed run shows as a failed cron invocation in Vercel; the next run retries.
    console.error('Retention job failed', error)
    return Response.json({ error: 'Retention job failed' }, { status: 500, headers: NO_STORE })
  }
}
