// Asks the RAG one question and prints the retrieved chunks, the answer and its sources.
// With --trace it prints every step of the chain: the question vector, the
// prompt sent to Claude and Claude's raw reply.
//
//   npm run rag:ask -- "Wann werden hochgeladene Abrechnungen gelöscht?"
//   npm run rag:ask -- --trace "Wann werden hochgeladene Abrechnungen gelöscht?"

import { answerQuestion, type ChainStep, DEFAULT_THRESHOLD } from './chain'
import { ANSWER_MODEL, liveDeps } from './live'
import { EMBEDDING_MODEL, ragConfig } from './store'
import { parseAskArgs, vectorPreview } from './trace'

const args = parseAskArgs(process.argv.slice(2))
if (!args) {
  console.error('Usage: npm run rag:ask -- [--trace] "<Frage, 3 bis 1000 Zeichen>"')
  process.exit(1)
}
const { question, trace } = args
const step = (n: number, title: string) => trace && console.log(`\n── ${n}. ${title} ──`)

step(1, 'Frage')
console.log(`Frage: ${question}`)

const onEmbedding = (vector: number[]) => {
  step(2, `Frage einbetten (${EMBEDDING_MODEL})`)
  console.log(vectorPreview(vector))
  const { index, namespace } = ragConfig(process.env)
  step(3, `Eigenen Index durchsuchen (Pinecone ${index} / ${namespace})`)
}

const onStep = (s: ChainStep) => {
  if (s.step === 'prompt') {
    step(5, 'Prompt mit Zitaten')
    console.log(`[System]\n${s.system}\n\n[User]\n${s.user}`)
  } else {
    step(6, `Rohe Antwort von ${ANSWER_MODEL}`)
    console.log(s.raw)
  }
}

const live = liveDeps(process.env, trace ? { onEmbedding } : {})
// Prints the hits as soon as the search returns, so in trace mode they come before the prompt.
const search = async (q: string) => {
  const hits = await live.search(q)
  if (trace) step(4, `Top-Abschnitte + Metadaten (Schwelle ${DEFAULT_THRESHOLD})`)
  else console.log('\nGefundene Abschnitte:')
  for (const h of hits) {
    console.log(`  ${h.score.toFixed(3)}  ${h.metadata.chunk_id}  ${h.metadata.source_file}, S. ${h.metadata.page}  ${h.metadata.heading}`)
  }
  return hits
}

const result = await answerQuestion(question, { ...live, search }, trace ? { onStep } : {})

step(7, 'Antwort + Quellen')
console.log(`\nAntwort: ${result.answer}`)
if (result.kind === 'answer') {
  console.log('\nQuellen:')
  for (const s of result.sources) console.log(`  ${s.source_file}, S. ${s.page} — ${s.heading} (${s.chunk_id})`)
} else {
  console.log(`(abgelehnt: ${result.reason})`)
}
