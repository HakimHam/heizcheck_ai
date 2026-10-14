import { readFile } from 'node:fs/promises'
import { describe, expect, it } from 'vitest'
import type { RagResult, SearchHit } from './chain'
import { REFUSAL } from './chain'
import { chunkSections } from './chunks'
import { type GoldenEntry, parseGoldenSet, scoreEntry } from './golden'
import { readPdfLines } from './pdf-lines'
import { toSections } from './sections'

const hit = (source_file: string, heading: string, id: string): SearchHit => ({
  score: 0.7,
  metadata: { source_file, heading, chunk_id: id, chunk_index: 0, page: 1, chunk_text: '…' },
})
const loeschen = hit('heizcheck-faq-richtlinien.pdf', 'FAQ > Löschfristen', 'heizcheck-faq-richtlinien#01')
const zugriff = hit('heizcheck-handbuch.pdf', 'Handbuch > Zugriff', 'heizcheck-handbuch#04')

const answer = (...cited: SearchHit[]): RagResult => ({
  kind: 'answer',
  answer: 'Nach 4 Jahren.',
  sources: cited.map((h) => h.metadata),
  retrieved: [loeschen, zugriff],
})
const refusal: RagResult = { kind: 'refusal', answer: REFUSAL, reason: 'below_threshold', retrieved: [] }

const expectsSources: GoldenEntry = {
  id: 1,
  type: 'real',
  question: 'Wann wird gelöscht?',
  expect: { sources: [{ source_file: 'heizcheck-faq-richtlinien.pdf', heading: 'FAQ > Löschfristen' }] },
}
const expectsRefusal: GoldenEntry = { id: 6, type: 'unanswerable', question: 'Wer ist der Chef?', expect: { refuse: true } }

describe('scoreEntry', () => {
  it('passes an answer that cites the expected source and heading', () => {
    expect(scoreEntry(expectsSources, answer(loeschen))).toMatchObject({ pass: true })
  })

  it('fails an answer that cites a different section', () => {
    expect(scoreEntry(expectsSources, answer(zugriff))).toMatchObject({ pass: false })
  })

  it('fails a refusal where an answer was expected, but notes the expected chunk was retrieved', () => {
    const refusedDespiteHit: RagResult = { ...refusal, reason: 'not_in_documents', retrieved: [loeschen] }

    expect(scoreEntry(expectsSources, refusedDespiteHit)).toMatchObject({ pass: false, retrievedExpected: true })
  })

  it('needs every expected source cited when the answer spans both PDFs', () => {
    const both: GoldenEntry = {
      ...expectsSources,
      expect: {
        sources: [
          { source_file: 'heizcheck-faq-richtlinien.pdf', heading: 'FAQ > Löschfristen' },
          { source_file: 'heizcheck-handbuch.pdf', heading: 'Handbuch > Zugriff' },
        ],
      },
    }

    expect(scoreEntry(both, answer(loeschen))).toMatchObject({ pass: false })
    expect(scoreEntry(both, answer(loeschen, zugriff))).toMatchObject({ pass: true })
  })

  it('passes a refusal where one was expected, and fails an answer there', () => {
    expect(scoreEntry(expectsRefusal, refusal)).toMatchObject({ pass: true })
    expect(scoreEntry(expectsRefusal, answer(loeschen))).toMatchObject({ pass: false })
  })
})

describe('parseGoldenSet', () => {
  it('accepts a valid golden set', () => {
    expect(parseGoldenSet([expectsSources, expectsRefusal])).toHaveLength(2)
  })

  it.each([
    ['an entry with neither sources nor refuse', [{ id: 1, type: 'real', question: 'Frage?', expect: {} }]],
    ['an unknown type', [{ ...expectsSources, type: 'leicht' }]],
    ['duplicate ids', [expectsSources, expectsSources]],
  ])('rejects %s', (_, data) => {
    expect(() => parseGoldenSet(data)).toThrow()
  })
})

describe('the committed golden set', () => {
  it('is valid and only expects headings that exist in the indexed PDFs', async () => {
    const golden = parseGoldenSet(JSON.parse(await readFile('scripts/rag/golden-set.json', 'utf8')))
    const indexed = new Set<string>()
    for (const file of ['heizcheck-handbuch.pdf', 'heizcheck-faq-richtlinien.pdf']) {
      const lines = await readPdfLines(new Uint8Array(await readFile(`docs/rag-source/${file}`)))
      for (const c of chunkSections(toSections(lines), file)) indexed.add(`${file} :: ${c.metadata.heading}`)
    }

    expect(golden).toHaveLength(10)
    for (const entry of golden) {
      if ('sources' in entry.expect) {
        for (const s of entry.expect.sources) expect(indexed).toContain(`${s.source_file} :: ${s.heading}`)
      }
    }
  })
})
