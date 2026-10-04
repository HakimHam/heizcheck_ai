// The extraction eval (ticket 11). Runs on demand, never in CI: it sends PDFs
// to Claude, which costs money, and its fixtures are gitignored.
//
//   npm run eval                       every package in eval/fixtures/
//   npm run eval -- 01-basis-6-we      some of them
//
// Each package is eval/fixtures/<name>/ with its PDFs and expected.json. The
// Extractor is the one EXTRACTOR selects (anthropic if unset; bedrock from
// ticket 17), so the eval measures the code that runs in the app. The
// Anthropic API is for synthetic or anonymised packages only.

import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { appExtractor } from '../src/lib/extractor'
import { type FieldScore, type Miss, scoreFigures } from '../src/lib/extractor/eval-score'
import type { Expected } from './make-fixture'

const FIXTURES = path.join('eval', 'fixtures')
const RESULTS = path.join('eval', 'results')
const TARGET = 0.95

type PackageResult = {
  name: string
  synthetic: boolean
  imageOnly: boolean
  correct: number
  total: number
  fields: Record<string, FieldScore>
  misses: Miss[]
  error?: string
  seconds: number
}

const env = { ...process.env, EXTRACTOR: process.env.EXTRACTOR || 'anthropic' }
if (env.EXTRACTOR === 'fake') {
  // .env.local may say fake for the app; scoring the fake would measure nothing.
  console.error('The eval measures a real Extractor. Run it with EXTRACTOR=anthropic (or bedrock from ticket 17).')
  process.exit(1)
}
const extractor = appExtractor(env)

const wanted = process.argv.slice(2)
const names = (await readdir(FIXTURES, { withFileTypes: true }).catch(() => []))
  .filter((entry) => entry.isDirectory() && (wanted.length === 0 || wanted.includes(entry.name)))
  .map((entry) => entry.name)
  .sort()
if (names.length === 0) {
  console.error(`No packages in ${FIXTURES}/. Run npm run make-fixture, or add real, redacted ones.`)
  process.exit(1)
}

const pct = (correct: number, total: number) => (total === 0 ? '–' : `${((100 * correct) / total).toFixed(1)} %`)
const results: PackageResult[] = []

console.log(`Extractor: EXTRACTOR=${env.EXTRACTOR}\n`)
for (const name of names) {
  const dir = path.join(FIXTURES, name)
  const expected = JSON.parse(await readFile(path.join(dir, 'expected.json'), 'utf8')) as Expected
  const files = (await readdir(dir)).filter((f) => f.toLowerCase().endsWith('.pdf')).sort()
  const pdfs = await Promise.all(
    files.map(async (fileName) => ({ fileName, bytes: new Uint8Array(await readFile(path.join(dir, fileName))) })),
  )

  const started = Date.now()
  const base = { name, synthetic: expected.synthetic === true, imageOnly: expected.imageOnly === true }
  let result: PackageResult
  try {
    const { figures } = await extractor.extract(pdfs)
    result = { ...base, ...scoreFigures(expected.figures, figures), seconds: (Date.now() - started) / 1000 }
  } catch (error) {
    // A failed extraction gets none of the package's figures right.
    const { total, fields } = scoreFigures(expected.figures, expected.figures)
    for (const field of Object.values(fields)) field.correct = 0
    result = { ...base, correct: 0, total, fields, misses: [], error: String(error), seconds: (Date.now() - started) / 1000 }
  }
  results.push(result)

  const tags = [result.synthetic ? 'synthetic' : 'real', result.imageOnly && 'image-only'].filter(Boolean).join(', ')
  console.log(`${name} (${tags}): ${result.correct}/${result.total} = ${pct(result.correct, result.total)} in ${result.seconds.toFixed(0)} s`)
  if (result.error) console.log(`  extraction failed: ${result.error}`)
  for (const miss of result.misses) {
    console.log(`  ${miss.path}: expected ${JSON.stringify(miss.expected)}, got ${JSON.stringify(miss.actual)}`)
  }
}

function report(label: string, group: PackageResult[]) {
  if (group.length === 0) return
  const fields: Record<string, FieldScore> = {}
  for (const result of group) {
    for (const [field, score] of Object.entries(result.fields)) {
      const sum = (fields[field] ??= { correct: 0, total: 0 })
      sum.correct += score.correct
      sum.total += score.total
    }
  }
  const correct = group.reduce((sum, r) => sum + r.correct, 0)
  const total = group.reduce((sum, r) => sum + r.total, 0)
  const verdict = total > 0 && correct / total >= TARGET ? 'meets' : 'misses'
  console.log(`\n===== ${label}: ${group.length} packages, ${correct}/${total} figures = ${pct(correct, total)} (${verdict} the ${TARGET * 100} % target) =====`)
  // CO₂ fields last, so they read as their own block.
  const order = (field: string) => (field.startsWith('building.co2') ? 1 : 0)
  const width = Math.max(...Object.keys(fields).map((f) => f.length))
  for (const [field, score] of Object.entries(fields).sort(([a], [b]) => order(a) - order(b) || a.localeCompare(b))) {
    console.log(`${field.padEnd(width)}  ${String(score.correct).padStart(4)}/${String(score.total).padEnd(4)} ${pct(score.correct, score.total)}`)
  }
}

report('Real packages', results.filter((r) => !r.synthetic))
report('SYNTHETIC packages', results.filter((r) => r.synthetic))
if (results.some((r) => r.synthetic)) {
  console.log(
    '\nSynthetic results test the pipeline; they are not evidence for the MVP target. That needs 5–10 real,' +
      ' properly redacted Minol packages run through Bedrock (tickets 16 and 17).',
  )
}

await mkdir(RESULTS, { recursive: true })
const file = path.join(RESULTS, `${new Date().toISOString().replace(/[:.]/g, '-')}.json`)
await writeFile(file, `${JSON.stringify({ extractor: env.EXTRACTOR, results }, null, 2)}\n`)
console.log(`\nDetails: ${file}`)
