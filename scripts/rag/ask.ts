// Asks the RAG one question and prints the retrieved chunks, the answer and its sources.
//
//   npm run rag:ask -- "Wann werden hochgeladene Abrechnungen gelöscht?"

import { answerQuestion, questionSchema } from './chain'
import { liveDeps } from './live'

const question = questionSchema.safeParse(process.argv.slice(2).join(' '))
if (!question.success) {
  console.error('Usage: npm run rag:ask -- "<Frage, 3 bis 1000 Zeichen>"')
  process.exit(1)
}

const result = await answerQuestion(question.data, liveDeps(process.env))

console.log(`Frage: ${question.data}\n\nGefundene Abschnitte:`)
for (const h of result.retrieved) console.log(`  ${h.score.toFixed(3)}  ${h.metadata.chunk_id}  ${h.metadata.heading}`)
console.log(`\nAntwort: ${result.answer}`)
if (result.kind === 'answer') {
  console.log('\nQuellen:')
  for (const s of result.sources) console.log(`  ${s.source_file}, S. ${s.page} — ${s.heading} (${s.chunk_id})`)
} else {
  console.log(`(abgelehnt: ${result.reason})`)
}
