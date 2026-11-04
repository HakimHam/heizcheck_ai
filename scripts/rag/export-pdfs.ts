// Exports the RAG source documents in docs/rag-source/ from Markdown to PDF.
//
//   npm run rag:pdf
//
// The PDFs are what gets indexed, so re-run this after editing the Markdown,
// then re-seed. Heading sizes are fixed here because the seed step finds
// headings by font size alone (see sections.ts).

import { readdir } from 'node:fs/promises'
import path from 'node:path'
import { mdToPdf } from 'md-to-pdf'
import { SOURCE_DIR } from './sources'

const CSS = `
  body { font-family: Arial, Helvetica, sans-serif; font-size: 11pt; line-height: 1.4; }
  h1 { font-size: 22pt; margin: 0 0 14pt; }
  h2 { font-size: 15pt; margin: 20pt 0 8pt; }
  h1, h2 { font-weight: bold; page-break-after: avoid; }
  p, ul { margin: 0 0 9pt; }
  li { margin: 0; }
`

const files = (await readdir(SOURCE_DIR)).filter((f) => f.endsWith('.md'))
for (const file of files) {
  const dest = path.join(SOURCE_DIR, file.replace(/\.md$/, '.pdf'))
  await mdToPdf(
    { path: path.join(SOURCE_DIR, file) },
    { dest, css: CSS, pdf_options: { format: 'A4', margin: { top: '20mm', bottom: '20mm', left: '20mm', right: '20mm' } } },
  )
  console.log(`${file} → ${dest}`)
}
