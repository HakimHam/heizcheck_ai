import type { NextRequest } from 'next/server'
import { renderCheckReportPdf } from '@/lib/check-report-pdf'
import { formatBillingPeriod } from '@/lib/dates'
import { requireSignedIn } from '@/lib/session'
import { getCheckReport, getPackage } from '@/lib/statement-packages'

// The package's Check Report as a PDF download. RLS hides other
// Organisations' packages, so they are simply not found.
export async function GET(_request: NextRequest, ctx: RouteContext<'/pakete/[id]/pruefbericht'>) {
  await requireSignedIn()
  const notFound = new Response('Prüfbericht nicht gefunden.', { status: 404 })
  const pkg = await getPackage((await ctx.params).id)
  if (!pkg) return notFound
  const report = await getCheckReport(pkg.id)
  if (!report) return notFound

  // The address as it was when checked, like the rest of the report.
  const fileName = `Prüfbericht ${report.address.street} ${formatBillingPeriod(
    report.confirmedFigures.building.billingPeriod,
  )}.pdf`
  return new Response(await renderCheckReportPdf(report), {
    headers: {
      'Content-Type': 'application/pdf',
      // The plain name is for browsers that can't read the UTF-8 one.
      'Content-Disposition': `attachment; filename="Pruefbericht.pdf"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      'Cache-Control': 'private, no-store',
    },
  })
}
