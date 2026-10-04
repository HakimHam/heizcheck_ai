// Prints what pdf.js reads from each page of a PDF, to check it has a real
// text layer (ticket 11). Runs locally; the PDF never leaves this machine.
//
//   node scripts/check-text-layer.mjs <file.pdf> [--items]
//
// --items also lists every text item with its position as page fractions,
// which shows how pdf.js splits amounts like "1.234,56 €".

import { readFile } from 'node:fs/promises'
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'

const [file, ...flags] = process.argv.slice(2)
if (!file) {
  console.error('Usage: node scripts/check-text-layer.mjs <file.pdf> [--items]')
  process.exit(1)
}
const showItems = flags.includes('--items')

// German amounts: 1.234,56 or 12,50 or 0,8
const AMOUNT = /\d{1,3}(?:\.\d{3})*,\d{1,3}/g

const pdf = await getDocument({ data: new Uint8Array(await readFile(file)), verbosity: 0 }).promise
let totalChars = 0
let totalAmounts = 0
let splitAmounts = 0

for (let n = 1; n <= pdf.numPages; n++) {
  const page = await pdf.getPage(n)
  const { width, height } = page.getViewport({ scale: 1 })
  const items = (await page.getTextContent()).items.filter((i) => 'str' in i && i.str.trim() !== '')

  // Group items into lines by their baseline, then read each line left to right.
  const lines = []
  for (const item of items) {
    const y = item.transform[5]
    const line = lines.find((l) => Math.abs(l.y - y) < 2)
    if (line) line.items.push(item)
    else lines.push({ y, items: [item] })
  }
  lines.sort((a, b) => b.y - a.y)

  console.log(`\n===== Page ${n} of ${pdf.numPages} (${items.length} text items) =====`)
  for (const line of lines) {
    line.items.sort((a, b) => a.transform[4] - b.transform[4])
    const text = line.items.map((i) => i.str).join(' ').replace(/\s+/g, ' ').trim()
    console.log(text)

    totalChars += text.length
    const inLine = text.match(AMOUNT)?.length ?? 0
    const inItems = line.items.reduce((sum, i) => sum + (i.str.match(AMOUNT)?.length ?? 0), 0)
    totalAmounts += inLine
    splitAmounts += Math.max(0, inLine - inItems)
  }

  if (showItems) {
    console.log(`----- items on page ${n}: [x, y, w, h] as page fractions -----`)
    for (const i of items) {
      const x = i.transform[4] / width
      const y = 1 - (i.transform[5] + i.height) / height
      const box = [x, y, i.width / width, i.height / height].map((v) => v.toFixed(3))
      console.log(`[${box.join(', ')}] ${JSON.stringify(i.str)}`)
    }
  }
}

console.log('\n===== Summary =====')
console.log(`Pages: ${pdf.numPages}`)
console.log(`Characters read: ${totalChars}`)
console.log(`Amounts found (like 1.234,56): ${totalAmounts}`)
console.log(`Amounts split across several text items: ${splitAmounts}`)
if (totalChars === 0) {
  console.log('No text layer: this PDF is probably a scan. Highlight boxes need another approach (ticket 11).')
} else if (totalAmounts === 0) {
  console.log('Text found, but no amounts. Check the output above: the numbers may be images or oddly encoded.')
} else {
  console.log('Text layer present. Check above that the amounts read exactly as printed in the PDF.')
}
