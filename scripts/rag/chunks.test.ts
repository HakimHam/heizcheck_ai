import { describe, expect, it } from 'vitest'
import { chunkSections, MAX_CHUNK_CHARS } from './chunks'
import type { Section } from './sections'

/** German-looking filler text of exactly `length` characters, made of whole words. */
function words(length: number): string {
  let out = ''
  while (out.length < length) out += out ? ' Wort' : 'Wort'
  return out.slice(0, length).trimEnd().padEnd(length, 'x')
}

const section = (h2: string | null, ...paragraphs: string[]): Section => ({
  h1: 'Handbuch',
  h2,
  paragraphs: paragraphs.map((text, i) => ({ text, page: i + 1 })),
})

describe('chunkSections', () => {
  it('keeps a section of exactly the maximum length as one chunk', () => {
    // Two paragraphs joined by a blank line: 499 + 2 + 499 = 1000.
    const chunks = chunkSections([section('Upload', words(499), words(499))], 'heizcheck-handbuch.pdf')

    expect(MAX_CHUNK_CHARS).toBe(1000)
    expect(chunks).toHaveLength(1)
    expect(chunks[0].metadata.chunk_text).toHaveLength(1000)
  })

  it('splits a section one character over the maximum on the paragraph boundary, with overlap', () => {
    // 500 + 2 + 499 = 1001.
    const first = words(500)
    const second = words(499)
    const chunks = chunkSections([section('Upload', first, second)], 'heizcheck-handbuch.pdf')

    expect(chunks).toHaveLength(2)
    expect(chunks[0].metadata.chunk_text).toBe(first)
    const overlap = chunks[1].metadata.chunk_text.replace(`\n\n${second}`, '')
    expect(first.endsWith(overlap)).toBe(true)
    expect(overlap.length).toBeGreaterThan(100)
    expect(overlap.length).toBeLessThanOrEqual(150)
    expect(overlap.startsWith(' ')).toBe(false)
  })

  it('splits a single paragraph longer than the maximum at word boundaries', () => {
    const chunks = chunkSections([section('Upload', words(2500))], 'heizcheck-handbuch.pdf')

    expect(chunks.length).toBeGreaterThanOrEqual(3)
    for (const c of chunks) expect(c.metadata.chunk_text.length).toBeLessThanOrEqual(MAX_CHUNK_CHARS + 150 + 2)
    for (const c of chunks) expect(c.metadata.chunk_text).not.toMatch(/(^ | $|Wor$)/)
  })

  it('tags each chunk with its source file, heading path, numbered id and start page', () => {
    const chunks = chunkSections(
      [section(null, 'Einleitung.'), section('Gebäude anlegen', 'Erster Absatz.', 'Zweiter Absatz.')],
      'heizcheck-handbuch.pdf',
    )

    expect(chunks.map((c) => c.metadata)).toEqual([
      {
        source_file: 'heizcheck-handbuch.pdf',
        heading: 'Handbuch',
        chunk_id: 'heizcheck-handbuch#00',
        chunk_index: 0,
        page: 1,
        chunk_text: 'Einleitung.',
      },
      {
        source_file: 'heizcheck-handbuch.pdf',
        heading: 'Handbuch > Gebäude anlegen',
        chunk_id: 'heizcheck-handbuch#01',
        chunk_index: 1,
        page: 1,
        chunk_text: 'Erster Absatz.\n\nZweiter Absatz.',
      },
    ])
    expect(chunks.map((c) => c.id)).toEqual(['heizcheck-handbuch#00', 'heizcheck-handbuch#01'])
  })

  it('puts the heading path in front of the text that gets embedded', () => {
    const [chunk] = chunkSections([section('Gebäude anlegen', 'Text.')], 'heizcheck-handbuch.pdf')

    expect(chunk.embedText).toBe('Handbuch > Gebäude anlegen\n\nText.')
  })
})
