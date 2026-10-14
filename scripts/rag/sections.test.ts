import { describe, expect, it } from 'vitest'
import { type PdfLine, toSections } from './sections'

/** A line of body text (12 pt) at height `y` on `page`. */
const body = (text: string, y: number, page = 1): PdfLine => ({ text, fontSize: 12, page, y })

describe('toSections', () => {
  it('finds H1 and H2 headings by font size and files body text under them', () => {
    const lines: PdfLine[] = [
      { text: 'HeizCheck Handbuch', fontSize: 24, page: 1, y: 800 },
      body('Einleitung zum Handbuch.', 770),
      { text: 'Gebäude anlegen', fontSize: 18, page: 1, y: 740 },
      body('Legen Sie zuerst ein Gebäude an.', 715),
    ]

    expect(toSections(lines)).toEqual([
      { h1: 'HeizCheck Handbuch', h2: null, paragraphs: [{ text: 'Einleitung zum Handbuch.', page: 1 }] },
      {
        h1: 'HeizCheck Handbuch',
        h2: 'Gebäude anlegen',
        paragraphs: [{ text: 'Legen Sie zuerst ein Gebäude an.', page: 1 }],
      },
    ])
  })

  // A 12 pt line starts a new paragraph after a gap of more than 1.8 × 12 = 21.6.
  it.each([
    { gap: 21.5, paragraphs: 1 },
    { gap: 21.6, paragraphs: 1 },
    { gap: 21.7, paragraphs: 2 },
  ])('a gap of $gap gives $paragraphs paragraph(s)', ({ gap, paragraphs }) => {
    const lines = [{ text: 'Titel', fontSize: 24, page: 1, y: 800 }, body('Erste Zeile.', 700), body('Zweite.', 700 - gap)]

    expect(toSections(lines)[0].paragraphs).toHaveLength(paragraphs)
  })

  it('joins the lines of one paragraph with a space', () => {
    const lines = [{ text: 'Titel', fontSize: 24, page: 1, y: 800 }, body('Erste Zeile', 700), body('zweite Zeile.', 685)]

    expect(toSections(lines)[0].paragraphs).toEqual([{ text: 'Erste Zeile zweite Zeile.', page: 1 }])
  })

  it('continues a paragraph across a page break, keeping the page it started on', () => {
    const lines = [{ text: 'Titel', fontSize: 24, page: 1, y: 800 }, body('Ende Seite eins', 60), body('und weiter.', 780, 2)]

    expect(toSections(lines)[0].paragraphs).toEqual([{ text: 'Ende Seite eins und weiter.', page: 1 }])
  })

  // A heading must be at least 1.15 × the body size: 13.8 pt for 12 pt body text.
  it.each([
    { size: 13.7, heading: false },
    { size: 13.8, heading: true },
    { size: 13.9, heading: true },
  ])('a $size pt line next to 12 pt body text is a heading: $heading', ({ size, heading }) => {
    const lines = [
      { text: 'Titel', fontSize: 24, page: 1, y: 800 },
      body('Ein langer Absatz Fließtext, damit 12 pt die Grundschrift ist.', 770),
      { text: 'Kandidat', fontSize: size, page: 1, y: 740 },
      body('Noch mehr Fließtext, damit 12 pt sicher die häufigste Größe bleibt.', 715),
    ]

    expect(toSections(lines).some((s) => s.h2 === 'Kandidat')).toBe(heading)
  })

  it('joins a heading that wraps onto a second line', () => {
    const lines = [
      { text: 'Titel', fontSize: 24, page: 1, y: 800 },
      { text: 'Ein sehr langer', fontSize: 18, page: 1, y: 760 },
      { text: 'Abschnittstitel', fontSize: 18, page: 1, y: 740 },
      body('Genug Fließtext, damit 12 pt die Grundschrift ist.', 715),
    ]

    expect(toSections(lines)[0].h2).toBe('Ein sehr langer Abschnittstitel')
  })

  // An 18 pt heading line wraps when the next one is at most 1.4 × 18 = 25.2 below it.
  it.each([
    { gap: 25.1, h2: ['Erste Zweite'] },
    { gap: 25.2, h2: ['Erste Zweite'] },
    { gap: 25.3, h2: ['Zweite'] },
  ])('heading lines $gap apart give the H2s $h2', ({ gap, h2 }) => {
    const lines = [
      { text: 'Titel', fontSize: 24, page: 1, y: 800 },
      { text: 'Erste', fontSize: 18, page: 1, y: 760 },
      { text: 'Zweite', fontSize: 18, page: 1, y: 760 - gap },
      body('Genug Fließtext, damit 12 pt die Grundschrift ist.', 700),
    ]

    expect(toSections(lines).map((s) => s.h2)).toEqual(h2)
  })

  it('drops headings without body text and text before the first heading', () => {
    const lines = [
      body('Kopfzeile ohne Überschrift.', 820),
      { text: 'Titel', fontSize: 24, page: 1, y: 800 },
      { text: 'Leer', fontSize: 18, page: 1, y: 770 },
      { text: 'Voll', fontSize: 18, page: 1, y: 740 },
      body('Text.', 715),
    ]

    expect(toSections(lines).map((s) => s.h2)).toEqual(['Voll'])
  })
})
