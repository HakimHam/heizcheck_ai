// Indexes the RAG source PDFs into our own Pinecone namespace.
//
//   npm run rag:seed
//
// Reads every PDF in docs/rag-source/, finds headings by font size, chunks the
// sections and replaces the whole namespace with the result, so re-running it
// never leaves stale or duplicate chunks behind.

import { readSourceChunks } from './sources'
import { ragConfig, vectorStore } from './store'

const config = ragConfig(process.env)
const chunks = await readSourceChunks()
for (const file of new Set(chunks.map((c) => c.metadata.source_file))) {
  console.log(`${file}: ${chunks.filter((c) => c.metadata.source_file === file).length} chunks`)
}

await vectorStore(config).reseed(chunks)
console.log(`Seeded ${chunks.length} chunks into ${config.index} / ${config.namespace}`)
