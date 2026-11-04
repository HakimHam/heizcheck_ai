import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
import type { TextItem } from 'pdfjs-dist/types/src/display/api'
import type { PdfLine } from './sections'

// Text items whose baselines are this close (in PDF units) sit on the same line.
const SAME_LINE = 1
// A horizontal gap wider than this share of the font size between two items is a space.
const SPACE_GAP = 0.15

/** One run of text pdf.js found on a page, with its position, width and font size. */
export type PositionedText = { text: string; x: number; y: number; width: number; fontSize: number }

/**
 * Reads a PDF's text as lines, top to bottom, each with its font size and
 * page, for {@link toSections} to find headings in.
 *
 * `readPdfLines(bytes)` → `[{text: 'HeizCheck Handbuch', fontSize: 22, page: 1, y: 785.2}, …]`
 */
export async function readPdfLines(bytes: Uint8Array): Promise<PdfLine[]> {
  const task = getDocument({ data: bytes.slice(), verbosity: 0 })
  const pdf = await task.promise
  const lines: PdfLine[] = []
  try {
    for (let page = 1; page <= pdf.numPages; page++) {
      const content = await (await pdf.getPage(page)).getTextContent()
      const items = content.items
        .filter((i): i is TextItem => 'str' in i && i.str.trim() !== '')
        .map((i) => ({
          text: i.str,
          x: i.transform[4],
          y: i.transform[5],
          width: i.width,
          // The font size is the scale of the text matrix.
          fontSize: Math.round(Math.hypot(i.transform[2], i.transform[3]) * 10) / 10,
        }))
      lines.push(...groupIntoLines(items, page))
    }
  } finally {
    await task.destroy()
  }
  return lines
}

/**
 * Joins one page's text runs into lines: runs whose baselines are at most
 * 1 unit apart share a line, and a gap wider than 0.15 × the font size
 * between two runs becomes a space. pdf.js often splits one word into
 * several runs, so adjacent runs are joined without a space.
 *
 * `groupIntoLines([{text: 'Heiz', x: 0, width: 10, …}, {text: 'kosten', x: 10, …}], 1)` → `[{text: 'Heizkosten', …}]`
 */
export function groupIntoLines(items: PositionedText[], page: number): PdfLine[] {
  const sorted = [...items].sort((a, b) => b.y - a.y || a.x - b.x)
  const lines: PdfLine[] = []
  let current: (PdfLine & { right: number }) | null = null
  for (const item of sorted) {
    if (current && Math.abs(current.y - item.y) <= SAME_LINE) {
      const gap = item.x - current.right
      const needsSpace = gap > item.fontSize * SPACE_GAP && !current.text.endsWith(' ') && !item.text.startsWith(' ')
      current.text += (needsSpace ? ' ' : '') + item.text
      current.right = item.x + item.width
      current.fontSize = Math.max(current.fontSize, item.fontSize)
    } else {
      if (current) lines.push(finish(current))
      current = { text: item.text, fontSize: item.fontSize, page, y: item.y, right: item.x + item.width }
    }
  }
  if (current) lines.push(finish(current))
  return lines
}

function finish({ text, fontSize, page, y }: PdfLine & { right: number }): PdfLine {
  return { text: text.replace(/\s+/g, ' ').trim(), fontSize, page, y }
}
