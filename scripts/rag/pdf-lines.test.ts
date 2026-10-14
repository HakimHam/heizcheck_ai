import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { readPdfLines } from './pdf-lines'
import { toSections } from './sections'

const SOURCE_DIR = path.join('docs', 'rag-source')

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
