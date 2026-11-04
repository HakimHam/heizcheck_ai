import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { type Chunk, chunkSections } from './chunks'
import { readPdfLines } from './pdf-lines'
import { toSections } from './sections'

/** Where the RAG's source documents live, as Markdown and as the exported PDFs that get indexed. */
export const SOURCE_DIR = path.join('docs', 'rag-source')

/** The regression questions `npm run rag:eval` runs. */
export const GOLDEN_SET_PATH = path.join('scripts', 'rag', 'golden-set.json')

/**
 * Every chunk of every PDF in {@link SOURCE_DIR}: exactly what the seed step
 * indexes, so tests can check against the real index contents without Pinecone.
 *
 * `readSourceChunks()` → `[{id: 'heizcheck-faq-richtlinien#00', …}, …, {id: 'heizcheck-handbuch#20', …}]`
 */
export async function readSourceChunks(): Promise<Chunk[]> {
  const files = (await readdir(SOURCE_DIR)).filter((f) => f.endsWith('.pdf')).sort()
  const chunks: Chunk[] = []
  for (const file of files) {
    const lines = await readPdfLines(new Uint8Array(await readFile(path.join(SOURCE_DIR, file))))
    chunks.push(...chunkSections(toSections(lines), file))
  }
  return chunks
}
