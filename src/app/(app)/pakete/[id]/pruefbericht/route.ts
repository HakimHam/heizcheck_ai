import type { NextRequest } from 'next/server'
import { getBuilding } from '@/lib/buildings'
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
  const [report, building] = await Promise.all([getCheckReport(pkg.id), getBuilding(pkg.buildingId)])
  if (!report || !building) return notFound

  const fileName = `Prüfbericht ${building.address.street} ${formatBillingPeriod(
    report.confirmedFigures.building.billingPeriod,
  )}.pdf`
  return new Response(await renderCheckReportPdf(report, building.address), {
    headers: {
      'Content-Type': 'application/pdf',
      // The plain name is for browsers that can't read the UTF-8 one.
      'Content-Disposition': `attachment; filename="Pruefbericht.pdf"; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      'Cache-Control': 'private, no-store',
    },
  })
}
