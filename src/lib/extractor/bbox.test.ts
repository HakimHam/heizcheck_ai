import { describe, expect, it } from 'vitest'
import { createTextLayerLocator } from './bbox'
import { testPdf } from './test-pdf'

const page1 = ['Heizkostenabrechnung 2025', 'Brennstoffkosten Erdgas 8.423,10 €', 'Gesamtkosten 9.500,00 €']
const page2 = ['CO2-Kosten', 'Kohlendioxidemissionen 19.876 kg']

async function pdfs() {
  return [
    { fileName: 'Gesamtabrechnung.pdf', bytes: await testPdf([page1, page2]) },
    { fileName: 'Einzelabrechnungen.pdf', bytes: await testPdf([['WE 01 1.512,38 €']]) },
  ]
}

describe('the text-layer bbox locator', () => {
  it('finds a quote on its page and boxes it in page fractions from the top left', async () => {
    const [box] = await createTextLayerLocator().locate(await pdfs(), [
      { file: 'Gesamtabrechnung.pdf', page: 1, quote: '9.500,00 €' },
    ])
    expect(box).not.toBeNull()
    const [x, y, w, h] = box!
    // The third line: 50pt + 2 × 30pt from the top of an 842pt page, right of its label.
    expect(x).toBeGreaterThan(50 / 595)
    expect(x + w).toBeLessThan(1)
    expect(y).toBeGreaterThan(100 / 842)
    expect(y).toBeLessThan(130 / 842)
    expect(h).toBeGreaterThan(0)
    expect(h).toBeLessThan(30 / 842)
  })

  it('boxes the whole line for a quote spanning several words', async () => {
    const [words, amount] = await createTextLayerLocator().locate(await pdfs(), [
      { file: 'Gesamtabrechnung.pdf', page: 1, quote: 'Brennstoffkosten Erdgas 8.423,10 €' },
      { file: 'Gesamtabrechnung.pdf', page: 1, quote: '8.423,10 €' },
    ])
    expect(words![0]).toBeLessThan(amount![0])
    expect(words![0] + words![2]).toBeCloseTo(amount![0] + amount![2], 2)
  })

  it('ignores differences in spacing and line breaks', async () => {
    const [box] = await createTextLayerLocator().locate(await pdfs(), [
      { file: 'Gesamtabrechnung.pdf', page: 2, quote: 'Kohlendioxidemissionen\n19.876  kg' },
    ])
    expect(box).not.toBeNull()
  })

  it('finds each quote in its own file and page', async () => {
    const boxes = await createTextLayerLocator().locate(await pdfs(), [
      { file: 'Einzelabrechnungen.pdf', page: 1, quote: '1.512,38 €' },
      { file: 'Gesamtabrechnung.pdf', page: 2, quote: '19.876 kg' },
    ])
    expect(boxes.every((box) => box !== null)).toBe(true)
  })

  it('finds nothing for a quote that is not on that page, a missing page or an unknown file', async () => {
    const boxes = await createTextLayerLocator().locate(await pdfs(), [
      { file: 'Gesamtabrechnung.pdf', page: 2, quote: '9.500,00 €' },
      { file: 'Gesamtabrechnung.pdf', page: 1, quote: '9.999,99 €' },
      { file: 'Gesamtabrechnung.pdf', page: 7, quote: '9.500,00 €' },
      { file: 'Andere.pdf', page: 1, quote: '9.500,00 €' },
      { file: 'Gesamtabrechnung.pdf', page: 1, quote: '   ' },
    ])
    expect(boxes).toEqual([null, null, null, null, null])
  })

  it('boxes nothing when the quote appears more than once on the page, rather than maybe the wrong one', async () => {
    const pdfs = [{ fileName: 'G.pdf', bytes: await testPdf([['Heizung 70 %', 'Warmwasser 70 %']]) }]
    const [twice, once] = await createTextLayerLocator().locate(pdfs, [
      { file: 'G.pdf', page: 1, quote: '70 %' },
      { file: 'G.pdf', page: 1, quote: 'Warmwasser 70 %' },
    ])
    expect(twice).toBeNull()
    expect(once).not.toBeNull()
  })

  it('leaves the PDF bytes intact for the caller', async () => {
    const input = await pdfs()
    const sizes = input.map((pdf) => pdf.bytes.length)
    await createTextLayerLocator().locate(input, [{ file: 'Gesamtabrechnung.pdf', page: 1, quote: '9.500,00 €' }])
    expect(input.map((pdf) => pdf.bytes.length)).toEqual(sizes)
  })
})
