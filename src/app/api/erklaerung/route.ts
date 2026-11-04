import { anthropicExplainModel } from '@/lib/explain-chat/anthropic-model'
import { explainChatEnabled, explainFinding } from '@/lib/explain-chat/explain'
import { type KnowledgeSection, loadKnowledge } from '@/lib/explain-chat/knowledge'
import { createClient } from '@/lib/supabase/server'

const NO_STORE = { 'Cache-Control': 'no-store' }

// Read once per server instance: the knowledge base only changes with a deploy.
let knowledge: Promise<KnowledgeSection[]> | undefined

/**
 * Answers a Property Manager's question about one Check Report rule from the
 * markdown knowledge base (ticket 20). Only the rule ID and the question come
 * in; no package data is read or sent. Off unless EXPLAIN_CHAT_ENABLED=true,
 * and on Vercel production only with EXPLAIN_CHAT_IN_PRODUCTION=true (ADR 0005).
 */
export async function POST(request: Request) {
  if (!explainChatEnabled()) return Response.json({ error: 'Not found' }, { status: 404, headers: NO_STORE })

  // The proxy already requires a session; a route handler checks it again
  // because it can be called directly.
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  if (!data?.claims) return Response.json({ error: 'Unauthorized' }, { status: 401, headers: NO_STORE })

  // A body that isn't JSON fails the same validation as a wrong one.
  const body: unknown = await request.json().catch(() => undefined)
  knowledge ??= loadKnowledge()
  const result = await explainFinding(body, { sections: await knowledge, model: anthropicExplainModel() })
  return Response.json(result.answer, { status: result.status, headers: NO_STORE })
}
