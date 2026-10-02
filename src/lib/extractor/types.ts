import type { ExtractedFigures } from '../figures'

/** One PDF of a Statement Package. */
export type StatementPdf = { fileName: string; bytes: Uint8Array }

/**
 * Reads a Statement Package's PDFs into Extracted Figures (test seam 2). It
 * only reports what the statement states and never judges it (ADR 0001).
 * A figure it can't find is null, never a guess.
 */
export interface Extractor {
  /** Rejects with `ExtractionFailed` when the PDFs can't be read; never returns partial figures. */
  extract(pdfs: StatementPdf[]): Promise<ExtractedFigures>
}

export class ExtractionFailed extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options)
    this.name = 'ExtractionFailed'
  }
}
