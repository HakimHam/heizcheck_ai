import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs'
import { describe, expect, it } from 'vitest'
import type { CheckResult, Finding } from './check-engine'
import { cleanFigures, cleanProfile } from './check-engine/fixtures'
import { DISCLAIMER } from './disclaimer'
import { renderCheckReportPdf } from './check-report-pdf'
import type { CheckReport } from './statement-packages'

/** The PDF's text, with line breaks and spacing collapsed to single spaces. */
async function pdfText(bytes: Uint8Array) {
  const pdf = await getDocument({ data: bytes }).promise
  const pages = await Promise.all(
    Array.from({ length: pdf.numPages }, async (_, i) => {
      const content = await (await pdf.getPage(i + 1)).getTextContent()
      return content.items.map((item) => ('str' in item ? item.str : '')).join(' ')
    }),
  )
  return pages.join(' ').replace(/\s+/g, ' ')
}

const finding = (overrides: Partial<Finding>): Finding => ({
  severity: 'error',
  legalReference: '§7 Abs. 1 HeizkostenV',
  message: 'Meldung',
  affectedUnits: [],
  amountAtStakeCents: null,
  ...overrides,
})

// Stored results that the figures below would never produce: the export must
// show them as stored.
const results: CheckResult[] = [
  { rule: 'C1', status: 'passed' },
  { rule: 'C2', status: 'not_assessable', reason: 'Die beheizte Fläche fehlt im Gebäudeprofil.' },
  { rule: 'C3', status: 'passed' },
  {
    rule: 'H1',
    status: 'finding',
    findings: [
      finding({
        severity: 'warning',
        legalReference: '§7 Abs. 1 Satz 2 HeizkostenV',
        message: 'Möglicherweise sind genau 70 % vorgeschrieben.',
      }),
      finding({
        message: 'Der Verbrauchsanteil Heizung liegt außerhalb von 50–70 %.',
        affectedUnits: ['WE 01', 'WE 02'],
        amountAtStakeCents: 123456,
      }),
    ],
  },
  { rule: 'H2', status: 'passed' },
  { rule: 'H3', status: 'passed' },
  { rule: 'H4', status: 'passed' },
  { rule: 'H5', status: 'passed' },
  { rule: 'K1', status: 'passed' },
  {
    rule: 'K2',
    status: 'finding',
    findings: [
      finding({
        severity: 'warning',
        legalReference: '§7 Abs. 3–4 CO2KostAufG',
        message: 'Die Abrechnung enthält keine CO₂-Angaben.',
      }),
    ],
  },
  { rule: 'B1', status: 'passed' },
]

const report: CheckReport = {
  id: '00000000-0000-4000-8000-000000000001',
  statementPackageId: '00000000-0000-4000-8000-000000000002',
  rulesetVersion: '0.4.2',
  dispatchDate: '2026-05-04',
  confirmedFigures: {
    ...cleanFigures,
    building: { ...cleanFigures.building, billingPeriod: { start: '2025-01-01', end: '2025-12-31' } },
  },
  buildingProfile: cleanProfile,
  results,
  // 22:30 UTC is already the next day in Germany.
  createdAt: '2026-05-03T22:30:00+00:00',
}

const address = { street: 'Schillerstr. 17', postalCode: '10625', city: 'Berlin' }

describe('renderCheckReportPdf', async () => {
  const text = await pdfText(await renderCheckReportPdf(report, address))

  it('is a Prüfbericht for the building, Billing Period, Dispatch Date and Ruleset version', () => {
    expect(text).toContain('Prüfbericht')
    expect(text).toContain('Schillerstr. 17, 10625 Berlin')
    expect(text).toContain('Abrechnungszeitraum 01.01.2025 – 31.12.2025')
    expect(text).toContain('Versanddatum 04.05.2026')
    expect(text).toContain('Regelwerk 0.4.2')
  })

  it('says when the Check Report was created, in German time', () => {
    expect(text).toContain('Erstellt am 04.05.2026, 00:30')
  })

  it('lists every Check Result as stored', () => {
    for (const rule of ['C1', 'C2', 'C3', 'H1', 'H2', 'H3', 'H4', 'H5', 'K1', 'K2', 'B1']) {
      expect(text).toMatch(new RegExp(`\\b${rule}\\b`))
    }
    expect(text).toContain('Verbrauchsanteil Heizung')
    expect(text).toContain('Nicht prüfbar')
    expect(text).toContain('Die beheizte Fläche fehlt im Gebäudeprofil.')
    expect(text).toContain('Bestanden')
    expect(text).toContain('1 Fehler, 2 Prüfhinweise, 1 nicht prüfbar')
  })

  it('shows each Finding’s Severity, legal reference, affected Units and amount at stake', () => {
    expect(text).toContain('Fehler · §7 Abs. 1 HeizkostenV')
    expect(text).toContain('Der Verbrauchsanteil Heizung liegt außerhalb von 50–70 %.')
    expect(text).toContain('Betroffen: WE 01, WE 02 · Betrag: 1.234,56 €')
    expect(text).toContain('Prüfhinweis · §7 Abs. 3–4 CO2KostAufG')
    expect(text).toContain('Die Abrechnung enthält keine CO₂-Angaben.')
    expect(text).toContain('Betroffen: ganzes Gebäude')
  })

  it('lists Errors before Warnings', () => {
    const error = text.indexOf('liegt außerhalb von 50–70 %')
    expect(error).toBeGreaterThan(-1)
    expect(error).toBeLessThan(text.indexOf('genau 70 % vorgeschrieben'))
    expect(text.indexOf('genau 70 % vorgeschrieben')).toBeLessThan(text.indexOf('keine CO₂-Angaben'))
    expect(text.indexOf('keine CO₂-Angaben')).toBeLessThan(text.indexOf('Nicht prüfbar'))
  })

  it('includes the disclaimer', () => {
    expect(text).toContain(DISCLAIMER)
  })

  it('numbers its pages', () => {
    expect(text).toMatch(/Seite 1 von \d/)
  })
})
