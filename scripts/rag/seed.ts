// Indexes the RAG source PDFs into our own Pinecone namespace.
//
//   npm run rag:seed
//
// Reads every PDF in docs/rag-source/, finds headings by font size, chunks the
// sections and replaces the whole namespace with the result, so re-running it
// never leaves stale or duplicate chunks behind.

import { readdir, readFile } from 'node:fs/promises'
import path from 'node:path'
import { type Chunk, chunkSections } from './chunks'
import { readPdfLines } from './pdf-lines'
import { toSections } from './sections'
import { ragConfig, vectorStore } from './store'

const SOURCE_DIR = path.join('docs', 'rag-source')

const config = ragConfig(process.env)
const chunks: Chunk[] = []
for (const file of (await readdir(SOURCE_DIR)).filter((f) => f.endsWith('.pdf'))) {
  const lines = await readPdfLines(new Uint8Array(await readFile(path.join(SOURCE_DIR, file))))
  const fileChunks = chunkSections(toSections(lines), file)
  console.log(`${file}: ${fileChunks.length} chunks`)
  chunks.push(...fileChunks)
}

await vectorStore(config).reseed(chunks)
console.log(`Seeded ${chunks.length} chunks into ${config.index} / ${config.namespace}`)
