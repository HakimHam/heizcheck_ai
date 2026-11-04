// Renders synthetic Statement Packages for the extraction eval (ticket 11).
//
//   npm run make-fixture                          every spec in eval/synthetic/
//   npm run make-fixture -- eval/synthetic/x.json one spec
//
// A spec is made-up figures: { description, wording?, imageOnly?, figures }.
// It is printed through an HTML template in the Minol layout with headless
// Chrome into eval/fixtures/<name>/ (Gesamtabrechnung.pdf, Einzelabrechnungen.pdf)
// with the same figures as expected.json. An image-only package has its pages
// as pictures, with no text layer, like a scan or the Minol Muster's
// scrambled one. Set CHROME_PATH if Chrome or Edge isn't found.

import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { promisify } from 'node:util'
import type { Figures } from '../src/lib/figures'
import { buildingPages, htmlDocument, unitPages, type Wording } from './template'

export type Spec = { description: string; wording?: Wording; imageOnly?: boolean; figures: Figures }

/** What expected.json holds. Real, hand-labelled packages leave out `synthetic`. */
export type Expected = { synthetic?: boolean; imageOnly?: boolean; description?: string; figures: Figures }

const run = promisify(execFile)
const SYNTHETIC = path.join('eval', 'synthetic')
const FIXTURES = path.join('eval', 'fixtures')

function chrome(): string {
  const candidates = [
    process.env.CHROME_PATH,
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium',
  ]
  const found = candidates.find((candidate) => candidate && existsSync(candidate))
  if (!found) throw new Error('Chrome not found. Set CHROME_PATH to a Chrome or Edge binary.')
  return found
}

/** Figures that would print one thing but expect another make the eval lie. */
function check(name: string, { building: b }: Figures) {
  const shares = [b.heatingConsumptionSharePct, b.hotWaterConsumptionSharePct]
  if (b.allocationMethod !== 'consumption_split' && shares.some((s) => s !== null)) {
    throw new Error(`${name}: consumption shares are printed only with allocationMethod "consumption_split".`)
  }
  if (b.allocationMethod === 'consumption_split' && shares.every((s) => s === null)) {
    throw new Error(`${name}: allocationMethod "consumption_split" is printed only with a consumption share.`)
  }
  if (b.fuel !== null && b.fuel.quantity !== null && !b.fuel.unit) {
    throw new Error(`${name}: a fuel quantity needs its unit.`)
  }
}

/** Headless Chrome on its own profile, so it doesn't touch a running browser. */
const headless = (work: string) => ['--headless=new', '--disable-gpu', `--user-data-dir=${path.join(work, 'profile')}`]

async function printPdf(browser: string, work: string, html: string, out: string) {
  const file = path.join(work, `${path.basename(out)}.html`)
  await writeFile(file, html)
  await run(browser, [
    ...headless(work),
    '--no-pdf-header-footer',
    `--print-to-pdf=${path.resolve(out)}`,
    file,
  ])
}

/** The pages as pictures: a screenshot of each, printed one per page. */
async function printImagePdf(browser: string, work: string, pages: string[], out: string) {
  const images: string[] = []
  for (const [i, page] of pages.entries()) {
    const file = path.join(work, `page-${i}.html`)
    const png = path.join(work, `page-${i}.png`)
    await writeFile(file, htmlDocument([page]))
    await run(browser, [
      ...headless(work),
      '--hide-scrollbars',
      '--window-size=794,1122',
      '--force-device-scale-factor=2',
      `--screenshot=${png}`,
      file,
    ])
    images.push((await readFile(png)).toString('base64'))
  }
  const html = `<!doctype html><html><head><style>
    @page { size: A4; margin: 0 } html, body { margin: 0 }
    img { display: block; width: 794px; height: 1122px; break-after: page }
    img:last-child { break-after: auto }
  </style></head><body>${images.map((data) => `<img src="data:image/png;base64,${data}">`).join('')}</body></html>`
  await printPdf(browser, work, html, out)
}

async function make(browser: string, specFile: string) {
  const name = path.basename(specFile, '.json')
  const spec = JSON.parse(await readFile(specFile, 'utf8')) as Spec
  check(name, spec.figures)
  const wording = spec.wording ?? 'a'

  const dir = path.join(FIXTURES, name)
  await rm(dir, { recursive: true, force: true })
  await mkdir(dir, { recursive: true })
  const work = await mkdtemp(path.join(tmpdir(), 'heizcheck-fixture-'))
  try {
    const files: [string, string[]][] = [
      ['Gesamtabrechnung.pdf', buildingPages(spec.figures, wording)],
      ['Einzelabrechnungen.pdf', unitPages(spec.figures, wording)],
    ]
    for (const [fileName, pages] of files) {
      const out = path.join(dir, fileName)
      if (spec.imageOnly) await printImagePdf(browser, work, pages, out)
      else await printPdf(browser, work, htmlDocument(pages), out)
    }
  } finally {
    await rm(work, { recursive: true, force: true })
  }

  const expected: Expected = {
    synthetic: true,
    imageOnly: spec.imageOnly ?? false,
    description: spec.description,
    figures: spec.figures,
  }
  await writeFile(path.join(dir, 'expected.json'), `${JSON.stringify(expected, null, 2)}\n`)
  console.log(`${dir}: ${spec.imageOnly ? 'image-only, ' : ''}${spec.figures.units.length} Units`)
}

const browser = chrome()
const specs = process.argv.slice(2)
const files = specs.length
  ? specs
  : (await readdir(SYNTHETIC)).filter((f) => f.endsWith('.json')).map((f) => path.join(SYNTHETIC, f))
for (const file of files) await make(browser, file)
