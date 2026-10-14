/** One line of text read from a PDF page, with the font size it was set in. `y` grows upwards, as in PDF coordinates. */
export type PdfLine = { text: string; fontSize: number; page: number; y: number }

/** A paragraph of body text and the page it starts on. */
export type Paragraph = { text: string; page: number }

/**
 * The body text under one heading of a source document. `h2` is null for text
 * that sits directly under an H1, before its first H2.
 */
export type Section = { h1: string; h2: string | null; paragraphs: Paragraph[] }

// A size must be this much bigger than the body text to count as a heading,
// so bold or slightly larger body lines aren't mistaken for one.
const HEADING_RATIO = 1.15
// A vertical gap of more than this many line heights starts a new paragraph.
const PARAGRAPH_GAP = 1.8
// A heading line this close below another of the same size is the same heading, wrapped.
const HEADING_WRAP_GAP = 1.4
// PDF coordinates are floats; `700 - 678.4` isn't exactly `21.6`.
const EPSILON = 1e-6

/**
 * Turns a PDF's lines into heading-tagged sections. Headings are found by
 * font size alone, because PDF text keeps no markup: the body size is the one
 * most characters are set in, the largest bigger size is H1 and any other
 * bigger size is H2. Text before the first heading is dropped.
 *
 * `[{text: 'Handbuch', fontSize: 24}, {text: 'Gebäude anlegen', fontSize: 18}, {text: 'Legen Sie…', fontSize: 12}]`
 * → `[{h1: 'Handbuch', h2: 'Gebäude anlegen', paragraphs: [{text: 'Legen Sie…'}]}]`
 */
export function toSections(lines: PdfLine[]): Section[] {
  const bodySize = mostCommonSize(lines)
  const headingSizes = [...new Set(lines.map((l) => l.fontSize))]
    .filter((s) => s >= bodySize * HEADING_RATIO)
    .sort((a, b) => b - a)
  const h1Size = headingSizes[0]

  const sections: Section[] = []
  let current: Section | null = null
  let previous: PdfLine | null = null

  for (const line of lines) {
    const text = line.text.trim()
    if (!text) continue

    if (headingSizes.includes(line.fontSize)) {
      const sameHeading =
        previous &&
        previous.fontSize === line.fontSize &&
        previous.page === line.page &&
        previous.y - line.y <= line.fontSize * HEADING_WRAP_GAP + EPSILON
      if (sameHeading && current) {
        // A heading wrapped onto a second line.
        if (current.h2 !== null && line.fontSize !== h1Size) current.h2 += ` ${text}`
        else if (current.h2 === null && line.fontSize === h1Size) current.h1 += ` ${text}`
      } else if (line.fontSize === h1Size) {
        current = { h1: text, h2: null, paragraphs: [] }
        sections.push(current)
      } else {
        current = { h1: sections.at(-1)?.h1 ?? '', h2: text, paragraphs: [] }
        sections.push(current)
      }
    } else if (current) {
      const last = current.paragraphs.at(-1)
      const continues =
        last &&
        previous &&
        !headingSizes.includes(previous.fontSize) &&
        (previous.page !== line.page || previous.y - line.y <= line.fontSize * PARAGRAPH_GAP + EPSILON)
      if (continues) last.text += ` ${text}`
      else current.paragraphs.push({ text, page: line.page })
    }
    previous = line
  }

  return sections.filter((s) => s.paragraphs.length > 0)
}

/** The font size most characters are set in. */
function mostCommonSize(lines: PdfLine[]): number {
  const chars = new Map<number, number>()
  for (const l of lines) chars.set(l.fontSize, (chars.get(l.fontSize) ?? 0) + l.text.length)
  let best = 0
  let bestCount = -1
  for (const [size, count] of chars) {
    if (count > bestCount) [best, bestCount] = [size, count]
  }
  return best
}
