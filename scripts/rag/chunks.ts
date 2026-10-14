import type { Paragraph, Section } from './sections'

/** A section longer than this many characters is split into several chunks. */
export const MAX_CHUNK_CHARS = 1000
/** How many characters at most a chunk repeats from the end of the one before it. */
export const OVERLAP_CHARS = 150

const PARAGRAPH_BREAK = '\n\n'

/** What every vector in the index carries besides its embedding, and what a citation names. */
export type ChunkMetadata = {
  /** The PDF the chunk came from, e.g. `heizcheck-handbuch.pdf`. */
  source_file: string
  /** The heading path, e.g. `HeizCheck Handbuch > Gebäude anlegen`. */
  heading: string
  /** `<file name without .pdf>#<two-digit index>`, e.g. `heizcheck-handbuch#07`; also the vector id. */
  chunk_id: string
  /** The chunk's position within its PDF, from 0. */
  chunk_index: number
  /** The page the chunk's text starts on. */
  page: number
  /** The chunk's text, without the heading. */
  chunk_text: string
}

/** One piece of a source document, ready to embed and store. */
export type Chunk = {
  id: string
  /** The heading path and the text, so short sections still match questions about their topic. */
  embedText: string
  metadata: ChunkMetadata
}

/**
 * Cuts one PDF's sections into chunks: one per section, or several when the
 * section is longer than {@link MAX_CHUNK_CHARS}. Splits fall on paragraph
 * boundaries (word boundaries inside an overlong paragraph), and each later
 * piece starts with up to {@link OVERLAP_CHARS} from the end of the one before,
 * so a fact that straddles a split is still found whole in one chunk.
 *
 * `chunkSections([{h1: 'Handbuch', h2: 'Upload', paragraphs: […]}], 'heizcheck-handbuch.pdf')`
 * → `[{id: 'heizcheck-handbuch#00', metadata: {heading: 'Handbuch > Upload', …}, …}]`
 */
export function chunkSections(sections: Section[], sourceFile: string): Chunk[] {
  const stem = sourceFile.replace(/\.pdf$/i, '')
  const chunks: Chunk[] = []

  for (const section of sections) {
    const heading = section.h2 ? `${section.h1} > ${section.h2}` : section.h1
    let previous: string | null = null
    for (const piece of pieces(section.paragraphs)) {
      const text = previous ? `${overlapFrom(previous)}${PARAGRAPH_BREAK}${piece.text}` : piece.text
      const index = chunks.length
      const id = `${stem}#${String(index).padStart(2, '0')}`
      chunks.push({
        id,
        embedText: `${heading}${PARAGRAPH_BREAK}${text}`,
        metadata: { source_file: sourceFile, heading, chunk_id: id, chunk_index: index, page: piece.page, chunk_text: text },
      })
      previous = piece.text
    }
  }
  return chunks
}

/** Groups paragraphs into pieces of at most MAX_CHUNK_CHARS, splitting an overlong paragraph at word boundaries. */
function pieces(paragraphs: Paragraph[]): Paragraph[] {
  const out: Paragraph[] = []
  let current: Paragraph | null = null
  for (const paragraph of paragraphs.flatMap(splitLongParagraph)) {
    if (current && current.text.length + PARAGRAPH_BREAK.length + paragraph.text.length <= MAX_CHUNK_CHARS) {
      current.text += PARAGRAPH_BREAK + paragraph.text
    } else {
      current = { ...paragraph }
      out.push(current)
    }
  }
  return out
}

function splitLongParagraph(paragraph: Paragraph): Paragraph[] {
  if (paragraph.text.length <= MAX_CHUNK_CHARS) return [paragraph]
  const out: Paragraph[] = []
  let rest = paragraph.text
  while (rest.length > MAX_CHUNK_CHARS) {
    const cut = rest.lastIndexOf(' ', MAX_CHUNK_CHARS)
    const at = cut > 0 ? cut : MAX_CHUNK_CHARS
    out.push({ text: rest.slice(0, at), page: paragraph.page })
    rest = rest.slice(at).trimStart()
  }
  if (rest) out.push({ text: rest, page: paragraph.page })
  return out
}

/** The last OVERLAP_CHARS or fewer of `text`, starting at a word. */
function overlapFrom(text: string): string {
  if (text.length <= OVERLAP_CHARS) return text
  const tail = text.slice(-OVERLAP_CHARS)
  const space = tail.indexOf(' ')
  return space >= 0 ? tail.slice(space + 1) : tail
}
