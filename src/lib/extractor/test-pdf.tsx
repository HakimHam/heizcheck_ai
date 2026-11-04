import { Document, Page, renderToBuffer, Text } from '@react-pdf/renderer'

/**
 * A PDF for tests: one A4 page per entry, each line of text printed 30pt
 * below the last, starting 50pt from the top.
 */
export async function testPdf(pages: string[][]): Promise<Uint8Array> {
  return new Uint8Array(
    await renderToBuffer(
      <Document>
        {pages.map((lines, p) => (
          <Page key={p} size="A4" style={{ paddingTop: 50, paddingLeft: 50, fontSize: 12 }}>
            {lines.map((line, i) => (
              <Text key={i} style={{ height: 30 }}>{line}</Text>
            ))}
          </Page>
        ))}
      </Document>,
    ),
  )
}
