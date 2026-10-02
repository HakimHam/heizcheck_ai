import { describe, expect, it } from 'vitest'
import { MAX_PDF_BYTES, pdfProblem, uploadProblem } from './upload'

const PDF_START = new TextEncoder().encode('%PDF-1.7\n')

describe('pdfProblem', () => {
  it('accepts a PDF', () => {
    expect(pdfProblem({ name: 'Gesamtabrechnung.pdf', size: 120_000 }, PDF_START)).toBeNull()
  })

  it('rejects a file that is not a PDF, naming it in German', () => {
    expect(
      pdfProblem({ name: 'Abrechnung.docx', size: 120_000 }, new TextEncoder().encode('PK\x03\x04')),
    ).toBe('„Abrechnung.docx“ ist keine PDF-Datei.')
  })

  it('rejects a file named .pdf whose content is not a PDF', () => {
    expect(pdfProblem({ name: 'scan.pdf', size: 100 }, new TextEncoder().encode('<html>'))).toBe(
      '„scan.pdf“ ist keine lesbare PDF-Datei.',
    )
  })

  it('rejects an empty file and one above the size limit', () => {
    expect(pdfProblem({ name: 'leer.pdf', size: 0 }, new Uint8Array())).toMatch(/leer/)
    expect(pdfProblem({ name: 'gross.pdf', size: MAX_PDF_BYTES + 1 }, PDF_START)).toMatch(/50 MB/)
  })
})

describe('uploadProblem', () => {
  const file = { name: 'Gesamtabrechnung.pdf', size: 120_000 }

  it('accepts a Statement Package with a Dispatch Date', () => {
    expect(uploadProblem({ dispatchDate: '2026-10-02', files: [file] })).toBeNull()
  })

  it('needs at least one PDF', () => {
    expect(uploadProblem({ dispatchDate: '2026-10-02', files: [] })).toMatch(/mindestens eine/)
  })

  it('needs a valid Dispatch Date', () => {
    expect(uploadProblem({ dispatchDate: '', files: [file] })).toMatch(/Versanddatum/)
    expect(uploadProblem({ dispatchDate: '2026-02-30', files: [file] })).toMatch(/Versanddatum/)
  })

  it('refuses files that are not named as PDFs', () => {
    expect(
      uploadProblem({ dispatchDate: '2026-10-02', files: [file, { name: 'x.xlsx', size: 10 }] }),
    ).toBe('„x.xlsx“ ist keine PDF-Datei.')
  })
})
