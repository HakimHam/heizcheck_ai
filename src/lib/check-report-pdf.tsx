import path from 'node:path'
import { Document, Font, Page, renderToBuffer, StyleSheet, Text, View } from '@react-pdf/renderer'
import { formatAddress } from './building-profile'
import type { Finding } from './check-engine'
import {
  affectedUnitsLabel,
  formatCreatedAt,
  orderForReport,
  RESULT_LABELS,
  RULE_TITLES,
  SEVERITY_LABELS,
  summarise,
  warningsLabel,
} from './check-report'
import { formatBillingPeriod, formatDate } from './dates'
import { DISCLAIMER } from './disclaimer'
import { formatCents } from './money'
import type { CheckReport } from './statement-packages'

// The Check Report as a PDF, to file or send to the Metering Provider. It
// renders the stored report and never runs the check engine again.

// The PDF standard fonts have no "₂" (CO₂), so the export embeds Noto Sans.
// next.config.ts traces the font files into the export route.
const FONTS = path.join(process.cwd(), 'assets', 'fonts')
Font.register({
  family: 'Noto Sans',
  fonts: [
    { src: path.join(FONTS, 'NotoSans-Regular.ttf'), fontWeight: 400 },
    { src: path.join(FONTS, 'NotoSans-Bold.ttf'), fontWeight: 700 },
  ],
})
// react-pdf hyphenates with English patterns, which splits German words wrongly.
Font.registerHyphenationCallback((word) => [word])

// Set per block, not on the page: an inherited lineHeight makes react-pdf drop
// the page numbers.
const LINE_HEIGHT = 1.4

const COLORS = { text: '#1f2933', muted: '#5f6b7a', error: '#b42318', warning: '#b54708', rule: '#d0d5dd' }

const styles = StyleSheet.create({
  page: {
    fontFamily: 'Noto Sans',
    fontSize: 10,
    color: COLORS.text,
    paddingTop: 48,
    paddingBottom: 56,
    paddingHorizontal: 48,
  },
  title: { fontSize: 18, fontWeight: 700, lineHeight: 1.2, marginBottom: 8 },
  muted: { color: COLORS.muted },
  meta: { lineHeight: LINE_HEIGHT, marginBottom: 12 },
  disclaimer: {
    lineHeight: LINE_HEIGHT,
    borderWidth: 1,
    borderColor: COLORS.rule,
    padding: 8,
    marginBottom: 12,
    fontSize: 9,
  },
  summary: { lineHeight: LINE_HEIGHT, marginBottom: 12 },
  bold: { fontWeight: 700 },
  result: { lineHeight: LINE_HEIGHT, borderTopWidth: 1, borderTopColor: COLORS.rule, paddingVertical: 8 },
  resultHead: { flexDirection: 'row', justifyContent: 'space-between' },
  finding: { marginTop: 6, paddingLeft: 8, borderLeftWidth: 2 },
  error: { borderLeftColor: COLORS.error },
  warning: { borderLeftColor: COLORS.warning },
  footer: { position: 'absolute', bottom: 24, left: 48, fontSize: 8, color: COLORS.muted },
  pageNumber: { position: 'absolute', bottom: 24, right: 48, fontSize: 8, color: COLORS.muted },
})

function FindingBlock({ finding }: { finding: Finding }) {
  return (
    <View style={[styles.finding, styles[finding.severity]]} wrap={false}>
      <Text>
        <Text style={styles.bold}>{SEVERITY_LABELS[finding.severity]}</Text> · {finding.legalReference}
      </Text>
      <Text>{finding.message}</Text>
      <Text style={styles.muted}>
        Betroffen: {affectedUnitsLabel(finding)}
        {finding.amountAtStakeCents !== null && ` · Betrag: ${formatCents(finding.amountAtStakeCents)}`}
      </Text>
    </View>
  )
}

function CheckReportDocument({ report }: { report: CheckReport }) {
  const { errors, warnings, notAssessable } = summarise(report.results)
  const addressLine = formatAddress(report.address)
  return (
    <Document title={`Prüfbericht – ${addressLine}`} author="HeizCheck" language="de-DE">
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>Prüfbericht</Text>
        <View style={styles.meta}>
          <Text style={styles.bold}>{addressLine}</Text>
          <Text>
            Abrechnungszeitraum {formatBillingPeriod(report.confirmedFigures.building.billingPeriod)}
          </Text>
          <Text>Versanddatum {formatDate(report.dispatchDate)}</Text>
          <Text style={styles.muted}>
            Erstellt am {formatCreatedAt(report.createdAt)} · Regelwerk {report.rulesetVersion}
          </Text>
        </View>

        <Text style={styles.disclaimer}>
          <Text style={styles.bold}>Hinweis:</Text> {DISCLAIMER}
        </Text>

        <Text style={styles.summary}>
          {errors} Fehler, {warnings} {warningsLabel(warnings)}, {notAssessable} nicht prüfbar
        </Text>

        {orderForReport(report.results).map((result) => (
          <View key={result.rule} style={styles.result}>
            <View style={styles.resultHead} wrap={false}>
              <Text>
                <Text style={styles.bold}>{result.rule}</Text> {RULE_TITLES[result.rule]}
              </Text>
              <Text style={styles.bold}>{RESULT_LABELS[result.status]}</Text>
            </View>
            {result.status === 'not_assessable' && <Text style={styles.muted}>{result.reason}</Text>}
            {result.status === 'finding' &&
              result.findings.map((finding, i) => <FindingBlock key={i} finding={finding} />)}
          </View>
        ))}

        <Text style={styles.footer} fixed>
          HeizCheck · Prüfbericht · {addressLine}
        </Text>
        <Text
          style={styles.pageNumber}
          render={({ pageNumber, totalPages }) => `Seite ${pageNumber} von ${totalPages}`}
          fixed
        />
      </Page>
    </Document>
  )
}

/** The stored Check Report as a German PDF. */
export async function renderCheckReportPdf(report: CheckReport): Promise<Uint8Array<ArrayBuffer>> {
  return new Uint8Array(await renderToBuffer(<CheckReportDocument report={report} />))
}
