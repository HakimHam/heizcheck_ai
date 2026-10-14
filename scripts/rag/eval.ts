// Runs the golden set against the live index and prints PASS/FAIL per question.
// Costs money and isn't deterministic, so it runs on demand, never in npm test.
//
//   npm run rag:eval
//
// Re-run after any pipeline change: documents, chunking, threshold, prompt or model.

import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { answerQuestion, type RagResult } from './chain'
import { parseGoldenSet, scoreEntry } from './golden'
import { liveDeps } from './live'

const golden = parseGoldenSet(JSON.parse(await readFile(path.join('scripts', 'rag', 'golden-set.json'), 'utf8')))
const deps = liveDeps(process.env)

let passed = 0
for (const entry of golden) {
  let result: RagResult | null = null
  let score
  try {
    result = await answerQuestion(entry.question, deps)
    score = scoreEntry(entry, result)
  } catch (err) {
    score = { pass: false, retrievedExpected: null, detail: `error: ${err instanceof Error ? err.message : String(err)}` }
  }
  if (score.pass) passed++

  const expected = 'refuse' in entry.expect ? 'refuse' : entry.expect.sources.map((s) => s.heading).join(' + ')
  console.log(`\n${score.pass ? 'PASS' : 'FAIL'}  #${entry.id} [${entry.type}] ${entry.question}`)
  console.log(`  expected:  ${expected}`)
  if (result) {
    console.log(`  retrieved: ${result.retrieved.map((h) => `${h.metadata.chunk_id} (${h.score.toFixed(3)})`).join(', ') || '—'}`)
    console.log(`  cited:     ${result.kind === 'answer' ? result.sources.map((s) => s.chunk_id).join(', ') : '—'}`)
    console.log(`  refused:   ${result.kind === 'refusal' ? `yes (${result.reason})` : 'no'}`)
    console.log(`  answer:    ${result.answer}`)
  }
  console.log(`  → ${score.detail}${score.retrievedExpected === false ? ' (expected chunk not retrieved)' : ''}`)
}

console.log(`\n${passed}/${golden.length} passed`)
process.exitCode = passed === golden.length ? 0 : 1
