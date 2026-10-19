import { forwardHelpMessage, helpChatEnabled } from '@/lib/help-chat'
import { createClient } from '@/lib/supabase/server'

const NO_STORE = { 'Cache-Control': 'no-store' }

/**
 * Takes a help message from the chat widget and forwards it to the n8n
 * workflow, which classifies and routes it (ticket 19). The sender is read
 * from the session, never from the body. Off unless N8N_HELP_WEBHOOK_URL is
 * set, which production leaves unset (ADR 0004).
 */
export async function POST(request: Request) {
  if (!helpChatEnabled()) return Response.json({ error: 'Not found' }, { status: 404, headers: NO_STORE })

  // The proxy already requires a session; a route handler checks it again
  // because it can be called directly.
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  if (!data?.claims) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE })
  const { data: organisation } = await supabase.from('organisations').select('name').maybeSingle()

  // A body that isn't JSON fails the same validation as a wrong one.
  const body: unknown = await request.json().catch(() => undefined)
  const result = await forwardHelpMessage(
    body,
    { userId: data.claims.sub, email: data.claims.email ?? '', organisationName: organisation?.name ?? '' },
    { env: process.env, fetch, now: new Date(), newId: () => crypto.randomUUID() },
  )
  return Response.json(result.answer, { status: result.status, headers: NO_STORE })
}
