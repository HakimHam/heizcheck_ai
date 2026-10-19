// Runs the explain chat's golden set against the real knowledge base and the
// real Claude Haiku, and saves every answer under eval/results/ (ticket 20).
// Needs ANTHROPIC_API_KEY. Usage: npm run eval:explain
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { anthropicExplainModel } from '../src/lib/explain-chat/anthropic-model'
import { explainFinding } from '../src/lib/explain-chat/explain'
import { grade, parseGoldenSet } from '../src/lib/explain-chat/golden'
import { loadKnowledge } from '../src/lib/explain-chat/knowledge'

const golden = parseGoldenSet(JSON.parse(await readFile('eval/explain-chat/golden-set.json', 'utf8')))
const sections = await loadKnowledge()
const model = anthropicExplainModel()

const results = []
for (const item of golden) {
  const started = Date.now()
  const result = await explainFinding({ ruleId: item.ruleId, question: item.question }, { sections, model })
  const passed = grade(item.expect, result)
  results.push({ ...item, passed, ms: Date.now() - started, result })
  const outcome = result.answer.outcome
  console.log(`${passed ? 'PASS' : 'FAIL'}  #${item.id} [${item.type}] ${outcome}  ${item.question}`)
}

const passed = results.filter((r) => r.passed).length
console.log(`\n${passed}/${results.length} passed`)
await mkdir('eval/results', { recursive: true })
const file = `eval/results/explain-chat-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
await writeFile(file, JSON.stringify({ model: model.model, passed, total: results.length, results }, null, 2))
console.log(`Saved to ${file}`)
