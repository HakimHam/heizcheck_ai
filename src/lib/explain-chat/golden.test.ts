import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import type { ExplainResult } from './explain'
import { grade, parseGoldenSet } from './golden'
import { loadKnowledge } from './knowledge'

const answered = (...headings: string[]): ExplainResult => ({
  status: 200,
  answer: { outcome: 'answered', answer: 'Antwort.', sources: headings.map((heading) => ({ file: 'x.md', heading })) },
})
const fallback = (outcome: 'no_context' | 'declined' | 'rejected'): ExplainResult => ({
  status: 200,
  answer: { outcome, answer: 'Dazu habe ich keine Information.', sources: [] },
})
const failed: ExplainResult = { status: 502, answer: { outcome: 'failed', error: 'weg' } }

describe('grade', () => {
  const wantsB1 = { headings: ['B1 – Abrechnungsfrist'] }

  it('passes an answer that cites every expected section', () => {
    expect(grade(wantsB1, answered('B1 – Abrechnungsfrist', 'Prüfergebnisse'))).toBe(true)
  })

  it('fails an answer missing an expected section', () => {
    expect(grade(wantsB1, answered('H3 – Umlagefähige Kostenarten'))).toBe(false)
  })

  it('fails a fallback where an answer was expected', () => {
    expect(grade(wantsB1, fallback('declined'))).toBe(false)
  })

  it.each(['no_context', 'declined', 'rejected'] as const)('passes the %s fallback where a refusal was expected', (outcome) => {
    expect(grade({ refuse: true }, fallback(outcome))).toBe(true)
  })

  it('fails an answer where a refusal was expected', () => {
    expect(grade({ refuse: true }, answered('B1 – Abrechnungsfrist'))).toBe(false)
  })

  it('fails a failed call either way', () => {
    expect(grade(wantsB1, failed)).toBe(false)
    expect(grade({ refuse: true }, failed)).toBe(false)
  })
})

describe('the golden set in eval/explain-chat/', () => {
  it('is valid and only expects sections that exist in the knowledge base', async () => {
    const golden = parseGoldenSet(JSON.parse(await readFile('eval/explain-chat/golden-set.json', 'utf8')))
    const headings = new Set((await loadKnowledge()).map((section) => section.heading))

    expect(golden.length).toBeGreaterThanOrEqual(10)
    for (const item of golden) {
      if ('headings' in item.expect) {
        for (const heading of item.expect.headings) expect(headings, `question ${item.id}`).toContain(heading)
      }
    }
  })

  it('rejects a question with an unknown rule ID', () => {
    expect(() => parseGoldenSet([{ id: 1, type: 'x', ruleId: 'Z9', question: 'q', expect: { refuse: true } }])).toThrow()
  })
})
