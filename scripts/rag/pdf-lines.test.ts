import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { groupIntoLines, readPdfLines } from './pdf-lines'
import { toSections } from './sections'
import { SOURCE_DIR } from './sources'

/** The H1 and H2 headings of a Markdown file, in order. */
async function markdownHeadings(file: string) {
  const md = await readFile(path.join(SOURCE_DIR, file), 'utf8')
  return {
    h1: md.match(/^# (.+)$/m)![1],
    h2: [...md.matchAll(/^## (.+)$/gm)].map((m) => m[1]),
  }
}

describe.each(['heizcheck-handbuch', 'heizcheck-faq-richtlinien'])('the exported %s.pdf', (name) => {
  it('reads back every Markdown heading, in order, as H1 and H2 sections', async () => {
    const { h1, h2 } = await markdownHeadings(`${name}.md`)
    const bytes = new Uint8Array(await readFile(path.join(SOURCE_DIR, `${name}.pdf`)))

    const sections = toSections(await readPdfLines(bytes))

    expect(sections.every((s) => s.h1 === h1)).toBe(true)
    expect(sections.filter((s) => s.h2).map((s) => s.h2)).toEqual(h2)
  })
})

describe('readPdfLines', () => {
  it('keeps German characters and gives each line its page', async () => {
    const bytes = new Uint8Array(await readFile(path.join(SOURCE_DIR, 'heizcheck-faq-richtlinien.pdf')))

    const lines = await readPdfLines(bytes)

    expect(lines.some((l) => l.text.includes('Löschfristen'))).toBe(true)
    expect(lines[0].page).toBe(1)
    expect(Math.max(...lines.map((l) => l.page))).toBeGreaterThan(1)
  })
})

describe('groupIntoLines', () => {
  const item = (text: string, x: number, y: number) => ({ text, x, y, width: 10, fontSize: 10 })

  // Items whose baselines differ by at most 1 unit are one line.
  it.each([
    { dy: 0.99, lines: 1 },
    { dy: 1, lines: 1 },
    { dy: 1.01, lines: 2 },
  ])('items $dy apart vertically make $lines line(s)', ({ dy, lines }) => {
    expect(groupIntoLines([item('Heiz', 0, 700), item('kosten', 20, 700 - dy)], 1)).toHaveLength(lines)
  })

  // A gap wider than 0.15 × the font size (1.5 at 10 pt) is a space.
  it.each([
    { x: 11.4, text: 'Heizkosten' },
    { x: 11.5, text: 'Heizkosten' },
    { x: 11.6, text: 'Heiz kosten' },
  ])('an item starting at x = $x after one ending at 10 reads "$text"', ({ x, text }) => {
    expect(groupIntoLines([item('Heiz', 0, 700), item('kosten', x, 700)], 1)).toEqual([
      { text, fontSize: 10, page: 1, y: 700 },
    ])
  })

  it('orders lines top to bottom and items left to right', () => {
    const lines = groupIntoLines([item('unten', 0, 600), item('rechts', 50, 700), item('links', 0, 700)], 2)

    expect(lines.map((l) => l.text)).toEqual(['links rechts', 'unten'])
    expect(lines.every((l) => l.page === 2)).toBe(true)
  })
})
