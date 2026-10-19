import { z } from 'zod'
import type { Env } from './extractor/mode'

/**
 * Whether the help chat shows. It is dev/demo only (ADR 0004): the n8n
 * workflow is not an EU sub-processor in the AV-Vertrag, so production leaves
 * `N8N_HELP_WEBHOOK_URL` unset and the icon never renders there.
 */
export function helpChatEnabled(env: Env = process.env): boolean {
  return Boolean(env.N8N_HELP_WEBHOOK_URL)
}

/**
 * The categories the n8n workflow sorts a help message into. The workflow's
 * prompt and output schema list them too; help-chat-workflow.test.ts keeps
 * both in step.
 */
export const HELP_CATEGORIES = [
  'befund_frage',
  'extraktion_fehler',
  'technisches_problem',
  'konto_zugang',
  'datenschutz',
  'sonstiges',
] as const

/** One category from the n8n workflow, e.g. `datenschutz`. */
export type HelpCategory = (typeof HELP_CATEGORIES)[number]

/** What the Property Manager sees for each category: `befund_frage` → `Frage zu einem Befund`. */
export const HELP_CATEGORY_LABELS: Record<HelpCategory, string> = {
  befund_frage: 'Frage zu einem Befund',
  extraktion_fehler: 'Fehler beim Auslesen',
  technisches_problem: 'Technisches Problem',
  konto_zugang: 'Konto & Zugang',
  datenschutz: 'Datenschutz',
  sonstiges: 'Sonstiges',
}

/** The longest summary n8n may return: one line in the widget and in the alert subject. */
export const MAX_HELP_SUMMARY_LENGTH = 140

/** Long enough for a detailed question, short enough to keep the model call small. */
export const MAX_HELP_MESSAGE_LENGTH = 2000

const MAX_PAGE_PATH_LENGTH = 200

const requestSchema = z.object({
  message: z
    .string()
    .trim()
    .min(1, 'Bitte geben Sie eine Nachricht ein.')
    .max(MAX_HELP_MESSAGE_LENGTH, `Die Nachricht darf höchstens ${MAX_HELP_MESSAGE_LENGTH} Zeichen lang sein.`),
  // Only a path inside HeizCheck, so support can open the page the user was on.
  pagePath: z
    .string()
    .max(MAX_PAGE_PATH_LENGTH)
    .regex(/^\/(?!\/)/, 'Ungültige Seitenangabe.'),
})

const replySchema = z.object({
  category: z.enum(HELP_CATEGORIES),
  summary: z.string().trim().min(1).max(MAX_HELP_SUMMARY_LENGTH),
})

/** The Property Manager who sent the message, taken from the session, never from the request body. */
export type HelpSender = { userId: string; email: string; organisationName: string }

/** What `forwardHelpMessage` needs from outside, so tests can fix the clock and fake n8n. */
export type HelpDeps = {
  env: Env
  fetch: (url: string, init?: RequestInit) => Promise<Response>
  now: Date
  newId: () => string
}

/** What the widget shows after sending, with the HTTP status for `/api/hilfe`. */
export type HelpResult =
  | {
      status: 200
      answer: { outcome: 'classified'; category: HelpCategory; label: string; summary: string; text: string }
    }
  | { status: 200; answer: { outcome: 'received'; text: string } }
  | { status: 400; answer: { outcome: 'invalid'; error: string } }
  | { status: 502; answer: { outcome: 'failed'; error: string } }

/** How long the user waits for the classification before we say it failed. */
export const N8N_TIMEOUT_MS = 10_000

/** What the widget says when the message did not reach n8n, so the Property Manager sends it again. */
export const HELP_NOT_SENT = 'Nachricht konnte nicht gesendet werden. Bitte später erneut versuchen.'

const FAILED: HelpResult = { status: 502, answer: { outcome: 'failed', error: HELP_NOT_SENT } }

const RECEIVED: HelpResult = {
  status: 200,
  answer: { outcome: 'received', text: 'Ihre Nachricht ist angekommen. Wir melden uns per E-Mail.' },
}

/**
 * Sends a Property Manager's help message to the n8n workflow and turns its
 * classification into what the widget shows. The sender comes from the session,
 * so n8n can trust who wrote it. A reply n8n's model got wrong still means the
 * message arrived; only n8n failing or taking over 10 s means it was not sent.
 */
export async function forwardHelpMessage(body: unknown, sender: HelpSender, deps: HelpDeps): Promise<HelpResult> {
  const parsed = requestSchema.safeParse(body)
  if (!parsed.success) {
    return { status: 400, answer: { outcome: 'invalid', error: parsed.error.issues[0].message } }
  }
  const request = parsed.data

  // A timer of our own rather than AbortSignal.timeout, so it also covers
  // reading the body and tests can drive it with fake timers.
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), N8N_TIMEOUT_MS)
  let replyBody: string
  try {
    const response = await deps.fetch(deps.env.N8N_HELP_WEBHOOK_URL ?? '', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-HeizCheck-Secret': deps.env.N8N_HELP_WEBHOOK_SECRET ?? '',
      },
      body: JSON.stringify({
        requestId: deps.newId(),
        message: request.message,
        pagePath: request.pagePath,
        user: { id: sender.userId, email: sender.email },
        organisationName: sender.organisationName,
        sentAt: deps.now.toISOString(),
      }),
      signal: controller.signal,
      cache: 'no-store',
    })
    if (!response.ok) return FAILED
    replyBody = await response.text()
  } catch {
    return FAILED
  } finally {
    clearTimeout(timer)
  }

  const reply = replySchema.safeParse(parseJson(replyBody))
  if (!reply.success) return RECEIVED
  const label = HELP_CATEGORY_LABELS[reply.data.category]
  return {
    status: 200,
    answer: {
      outcome: 'classified',
      category: reply.data.category,
      label,
      summary: reply.data.summary,
      text: `Danke! Ihre Anfrage wurde als „${label}“ eingeordnet. Wir melden uns per E-Mail.`,
    },
  }
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}
