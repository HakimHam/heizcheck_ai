import { describe, expect, it, vi } from 'vitest'
import { answerQuestion, buildPrompt, DEFAULT_THRESHOLD, RagOutputError, REFUSAL, type SearchHit, TOP_K } from './chain'

const hit = (n: number, score: number): SearchHit => ({
  score,
  metadata: {
    source_file: 'heizcheck-faq-richtlinien.pdf',
    heading: `FAQ > Abschnitt ${n}`,
    chunk_id: `heizcheck-faq-richtlinien#0${n}`,
    chunk_index: n,
    page: n,
    chunk_text: `Text ${n}`,
  },
})

/** Deps whose search returns `hits` and whose model replies with `reply`. */
function deps(hits: SearchHit[], reply: unknown = { answerable: true, answer: 'Nach 4 Jahren.', citations: ['heizcheck-faq-richtlinien#01'] }) {
  return {
    search: vi.fn(async () => hits),
    generate: vi.fn(async (_system: string, _user: string) => (typeof reply === 'string' ? reply : JSON.stringify(reply))),
  }
}

const t = 0.4 // threshold under test

describe('answerQuestion', () => {
  it.each([
    { score: t - 0.001, refuses: true },
    { score: t, refuses: false },
    { score: t + 0.001, refuses: false },
  ])('with a top score of $score against a threshold of 0.4, refuses: $refuses', async ({ score, refuses }) => {
    const d = deps([hit(1, score)])

    const result = await answerQuestion('Wann wird gelöscht?', d, { threshold: t })

    expect(result.kind).toBe(refuses ? 'refusal' : 'answer')
    expect(d.generate).toHaveBeenCalledTimes(refuses ? 0 : 1)
  })

  it('refuses below the threshold with the fixed text and without asking the model', async () => {
    const d = deps([hit(1, 0.1)])

    const result = await answerQuestion('Wie heißt der Geschäftsführer?', d, { threshold: t })

    expect(result).toMatchObject({ kind: 'refusal', reason: 'below_threshold', answer: REFUSAL })
  })

  it('refuses when nothing is retrieved', async () => {
    const result = await answerQuestion('Irgendwas?', deps([]), { threshold: t })

    expect(result).toMatchObject({ kind: 'refusal', reason: 'below_threshold' })
  })

  it('puts only the best TOP_K = 3 of more hits into the prompt', async () => {
    const d = deps([1, 2, 3, 4, 5].map((n) => hit(n, 0.9 - n / 100)))

    const result = await answerQuestion('Frage?', d, { threshold: t })

    expect(TOP_K).toBe(3)
    expect(result.retrieved).toHaveLength(3)
    const user = d.generate.mock.calls[0][1] as string
    expect(user).toContain('[3] heizcheck-faq-richtlinien#03')
    expect(user).not.toContain('heizcheck-faq-richtlinien#04')
  })

  it('uses a default threshold of 0.30', () => {
    expect(DEFAULT_THRESHOLD).toBe(0.3)
  })

  it('returns the answer with the cited chunks as sources', async () => {
    const result = await answerQuestion('Wann wird gelöscht?', deps([hit(1, 0.8), hit(2, 0.7)]), { threshold: t })

    expect(result).toMatchObject({ kind: 'answer', answer: 'Nach 4 Jahren.' })
    expect(result.kind === 'answer' && result.sources.map((s) => s.chunk_id)).toEqual(['heizcheck-faq-richtlinien#01'])
  })

  it('refuses with the fixed text when the model says the context does not answer the question', async () => {
    const d = deps([hit(1, 0.8)], { answerable: false, answer: 'Weiß ich nicht.', citations: [] })

    const result = await answerQuestion('Was kostet HeizCheck?', d, { threshold: t })

    expect(result).toMatchObject({ kind: 'refusal', reason: 'not_in_documents', answer: REFUSAL })
  })

  it('accepts a reply wrapped in a ```json fence', async () => {
    const reply = '```json\n{"answerable": true, "answer": "Ja.", "citations": ["heizcheck-faq-richtlinien#01"]}\n```'

    const result = await answerQuestion('Frage?', deps([hit(1, 0.8)], reply), { threshold: t })

    expect(result).toMatchObject({ kind: 'answer', answer: 'Ja.' })
  })

  it.each([
    ['a citation that was not retrieved', { answerable: true, answer: 'Ja.', citations: ['erfunden#99'] }],
    ['an answer without citations', { answerable: true, answer: 'Ja.', citations: [] }],
    ['a reply missing a field', { answer: 'Ja.', citations: ['heizcheck-faq-richtlinien#01'] }],
    ['a reply that is not JSON', 'Die Antwort ist ja.'],
  ])('rejects %s', async (_, reply) => {
    await expect(answerQuestion('Frage?', deps([hit(1, 0.8)], reply), { threshold: t })).rejects.toBeInstanceOf(RagOutputError)
  })
})

describe('buildPrompt', () => {
  it('numbers every retrieved chunk with its id, source, heading and page', () => {
    const { user } = buildPrompt('Wann wird gelöscht?', [hit(1, 0.8), hit(2, 0.7), hit(3, 0.6)])

    for (const n of [1, 2, 3]) {
      expect(user).toContain(`[${n}] heizcheck-faq-richtlinien#0${n} · heizcheck-faq-richtlinien.pdf · FAQ > Abschnitt ${n} · S. ${n}`)
      expect(user).toContain(`Text ${n}`)
    }
    expect(user).toContain('Wann wird gelöscht?')
  })

  it('tells the model to answer only from the context and to cite chunk ids', () => {
    const { system } = buildPrompt('Frage?', [hit(1, 0.8)])

    expect(system).toMatch(/ausschließlich/)
    expect(system).toContain('citations')
    expect(system).toContain('answerable')
  })
})
