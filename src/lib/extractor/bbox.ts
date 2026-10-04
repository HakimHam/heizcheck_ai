import { getDocument, type PDFDocumentLoadingTask, type PDFDocumentProxy } from 'pdfjs-dist/legacy/build/pdf.mjs'
import type { TextItem } from 'pdfjs-dist/types/src/display/api'
import type { Bbox } from '../figures'
import type { StatementPdf } from './types'

/** A figure's text as printed, and the page the Extractor read it from. */
export type Quote = { file: string; page: number; quote: string }

/**
 * Works out where quotes are on their pages, so the Confirm screen can
 * highlight them. Repeatable code, never the AI: a model's coordinates aren't
 * reliable. Another strategy (OCR, ticket 18) can stand behind the same
 * interface.
 */
export interface BboxLocator {
  /** One box per quote, in order; null where it isn't found. */
  locate(pdfs: StatementPdf[], quotes: Quote[]): Promise<(Bbox | null)[]>
}

/**
 * Finds each quote in its page's pdf.js text layer, ignoring whitespace. A
 * scrambled text layer (fonts without a character mapping, like the Minol
 * Muster's) simply yields no match.
 */
export function createTextLayerLocator(): BboxLocator {
  return {
    async locate(pdfs, quotes) {
      const open = new Map<string, PDFDocumentLoadingTask>()
      const document = async (file: string): Promise<PDFDocumentProxy | null> => {
        let task = open.get(file)
        if (!task) {
          const pdf = pdfs.find((p) => p.fileName === file)
          if (!pdf) return null
          // pdf.js takes ownership of the bytes it is given, so it gets a copy.
          task = getDocument({ data: pdf.bytes.slice(), verbosity: 0 })
          open.set(file, task)
        }
        return task.promise.catch(() => null)
      }
      try {
        return await Promise.all(
          quotes.map(async ({ file, page, quote }) => {
            const pdf = await document(file)
            if (!pdf || !Number.isInteger(page) || page < 1 || page > pdf.numPages) return null
            return findOnPage(pdf, page, quote)
          }),
        )
      } finally {
        await Promise.all([...open.values()].map((task) => task.destroy()))
      }
    },
  }
}

const WHITESPACE = /\s/u

async function findOnPage(pdf: PDFDocumentProxy, pageNumber: number, quote: string): Promise<Bbox | null> {
  const wanted = quote.normalize('NFKC').replace(/\s+/gu, '')
  if (!wanted) return null

  const page = await pdf.getPage(pageNumber)
  const viewport = page.getViewport({ scale: 1 })
  const items = (await page.getTextContent()).items.filter(
    (item): item is TextItem => 'str' in item && item.str !== '',
  )

  // The page's text without whitespace, and for each of its characters the
  // item it came from and its offset in that item's text.
  let text = ''
  const origin: { item: TextItem; offset: number }[] = []
  for (const item of items) {
    const chars = [...item.str.normalize('NFKC')]
    chars.forEach((char, offset) => {
      if (WHITESPACE.test(char)) return
      text += char
      origin.push({ item, offset })
    })
  }

  const start = text.indexOf(wanted)
  // A quote printed twice (a short one like "70 %") can't say which is meant; no box beats a wrong one.
  if (start < 0 || text.indexOf(wanted, start + 1) >= 0) return null
  const matched = origin.slice(start, start + wanted.length)

  // Each item's matched characters, placed in proportion to their offset.
  const boxes = new Map<TextItem, { from: number; to: number }>()
  for (const { item, offset } of matched) {
    const span = boxes.get(item)
    if (span) span.to = offset + 1
    else boxes.set(item, { from: offset, to: offset + 1 })
  }
  let left = Infinity
  let top = Infinity
  let right = -Infinity
  let bottom = -Infinity
  for (const [item, { from, to }] of boxes) {
    const length = [...item.str.normalize('NFKC')].length
    const [, , , , x, y] = item.transform
    const x0 = x + (item.width * from) / length
    const x1 = x + (item.width * to) / length
    // From a little below the baseline (descenders) to the font's height above it.
    const corners = [
      viewport.convertToViewportPoint(x0, y - item.height * 0.25),
      viewport.convertToViewportPoint(x1, y + item.height),
    ]
    for (const [vx, vy] of corners) {
      left = Math.min(left, vx)
      right = Math.max(right, vx)
      top = Math.min(top, vy)
      bottom = Math.max(bottom, vy)
    }
  }
  if (!(right > left && bottom > top)) return null
  const fraction = (value: number, size: number) => Math.min(Math.max(value / size, 0), 1)
  const x = fraction(left, viewport.width)
  const y = fraction(top, viewport.height)
  return [x, y, fraction(right, viewport.width) - x, fraction(bottom, viewport.height) - y]
}
