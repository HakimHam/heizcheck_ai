// The deterministic RAG chain, forked from dl-school-agentic's
// example/rag/deterministic-chain.ts: it always retrieves, then prompts, then
// calls the model; the model never decides whether to search. Unlike the
// example, it refuses on its own when retrieval finds nothing close enough,
// and it rejects model output that cites chunks it was never shown.

import { z } from 'zod'
import type { ChunkMetadata } from './chunks'

/** How many chunks go into the prompt. */
export const TOP_K = 3

/**
 * Below this cosine score for the best match, the chain refuses without
 * calling the model. It only catches off-topic questions: measured on
 * 2026-10-14, "Wetter in Berlin" scored 0.276, the English golden question
 * 0.444, but the unanswerable on-topic ones (CEO, price) 0.62–0.68, as high
 * as real questions. Those are refused by the model, not by this threshold.
 */
export const DEFAULT_THRESHOLD = 0.3

/** The one refusal text, so a refusal reads the same whether the threshold or the model refused. */
export const REFUSAL = 'Dazu enthalten die HeizCheck-Dokumente keine Information.'

/** One chunk the vector store returned for a question, with its cosine similarity. */
export type SearchHit = { score: number; metadata: ChunkMetadata }

/** What the chain needs from the outside: a vector search and a chat model. */
export type RagDeps = {
  /** The best matching chunks for `question`, best first. */
  search(question: string): Promise<SearchHit[]>
  /** The model's raw text reply to a system and a user message. */
  generate(system: string, user: string): Promise<string>
}

/** The chain's result: an answer with the chunks it cites, or the fixed refusal and why. */
export type RagResult =
  | { kind: 'answer'; answer: string; sources: ChunkMetadata[]; retrieved: SearchHit[] }
  | { kind: 'refusal'; answer: typeof REFUSAL; reason: 'below_threshold' | 'not_in_documents'; retrieved: SearchHit[] }

/** The model replied with something other than a valid, honestly cited answer. */
export class RagOutputError extends Error {
  override name = 'RagOutputError'
}

/** A question from the command line or the golden set. */
export const questionSchema = z.string().trim().min(3).max(1000)

const modelAnswerSchema = z.object({
  answerable: z.boolean(),
  answer: z.string(),
  citations: z.array(z.string()),
})

/**
 * Answers `question` from the indexed HeizCheck documents, citing its sources.
 *
 * `answerQuestion('Wann werden Abrechnungen gelöscht?', deps)`
 * → `{kind: 'answer', answer: 'Nach 4 Jahren …', sources: [{chunk_id: 'heizcheck-faq-richtlinien#02', …}]}`
 */
export async function answerQuestion(
  question: string,
  deps: RagDeps,
  { threshold = DEFAULT_THRESHOLD }: { threshold?: number } = {},
): Promise<RagResult> {
  const retrieved = (await deps.search(question)).slice(0, TOP_K)
  if (!retrieved.length || retrieved[0].score < threshold) {
    return { kind: 'refusal', answer: REFUSAL, reason: 'below_threshold', retrieved }
  }

  const { system, user } = buildPrompt(question, retrieved)
  const reply = parseModelAnswer(await deps.generate(system, user), retrieved)
  if (!reply.answerable) return { kind: 'refusal', answer: REFUSAL, reason: 'not_in_documents', retrieved }

  const sources = reply.citations.map((id) => retrieved.find((h) => h.metadata.chunk_id === id)!.metadata)
  return { kind: 'answer', answer: reply.answer, sources, retrieved }
}

/**
 * The system and user messages for one question. Each chunk is numbered and
 * labelled `[n] <chunk_id> · <source_file> · <heading> · S. <page>`, so the
 * model can cite it by id.
 */
export function buildPrompt(question: string, hits: SearchHit[]): { system: string; user: string } {
  const system = [
    'Du beantwortest Fragen zu HeizCheck ausschließlich anhand des Kontexts unten.',
    'Nutze kein Vorwissen. Wenn der Kontext die Frage nicht beantwortet, setze "answerable" auf false.',
    'Antworte in der Sprache der Frage, kurz und sachlich.',
    'Antworte nur mit JSON in dieser Form:',
    '{"answerable": boolean, "answer": string, "citations": string[]}',
    '"citations" enthält die chunk_id jedes Kontextabschnitts, auf den sich die Antwort stützt (z. B. "heizcheck-handbuch#03").',
  ].join('\n')

  const context = hits
    .map((h, i) => {
      const m = h.metadata
      return `[${i + 1}] ${m.chunk_id} · ${m.source_file} · ${m.heading} · S. ${m.page}\n${m.chunk_text}`
    })
    .join('\n\n')

  return { system, user: `Kontext:\n${context}\n\nFrage: ${question}` }
}

/** Parses and checks the model's reply; every citation must be one of the retrieved chunks. */
function parseModelAnswer(raw: string, retrieved: SearchHit[]) {
  const json = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  let data: unknown
  try {
    data = JSON.parse(json)
  } catch {
    throw new RagOutputError(`The model's reply is not JSON: ${raw.slice(0, 200)}`)
  }

  const parsed = modelAnswerSchema.safeParse(data)
  if (!parsed.success) throw new RagOutputError(`The model's reply has the wrong shape: ${parsed.error.message}`)

  const reply = parsed.data
  if (reply.answerable) {
    if (!reply.citations.length) throw new RagOutputError('The model answered without citing a source')
    const known = new Set(retrieved.map((h) => h.metadata.chunk_id))
    const invented = reply.citations.filter((id) => !known.has(id))
    if (invented.length) throw new RagOutputError(`The model cited chunks it was not given: ${invented.join(', ')}`)
  }
  return reply
}
