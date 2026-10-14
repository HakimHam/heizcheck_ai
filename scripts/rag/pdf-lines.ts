import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
import type { TextItem } from 'pdfjs-dist/types/src/display/api'
import type { PdfLine } from './sections'

// Text items whose baselines are this close (in PDF units) sit on the same line.
const SAME_LINE = 1
// A horizontal gap wider than this share of the font size between two items is a space.
const SPACE_GAP = 0.15

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
        .sort((a, b) => b.y - a.y || a.x - b.x)

      let current: (PdfLine & { right: number }) | null = null
      for (const item of items) {
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
    }
  } finally {
    await task.destroy()
  }
  return lines
}

function finish({ text, fontSize, page, y }: PdfLine & { right: number }): PdfLine {
  return { text: text.replace(/\s+/g, ' ').trim(), fontSize, page, y }
}
