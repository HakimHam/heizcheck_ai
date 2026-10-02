import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { AutoRefresh } from '@/components/auto-refresh'
import { CheckReportView } from '@/components/check-report-view'
import { ConfirmForm } from '@/components/confirm-form'
import { PackageProgress } from '@/components/package-progress'
import { unknownFacts } from '@/lib/building-profile'
import { getBuilding } from '@/lib/buildings'
import { formatBillingPeriod, formatDate } from '@/lib/dates'
import { isExtractionStuck, PACKAGE_STATUS_LABELS } from '@/lib/package-status'
import { getCheckReport, getPackage } from '@/lib/statement-packages'
import { confirmStatementPackage, extractStatementPackage } from '../actions'

export const metadata: Metadata = { title: 'Abrechnungspaket – HeizCheck' }

type Props = { params: Promise<{ id: string }> }

export default async function PackagePage({ params }: Props) {
  // RLS hides other Organisations' packages, so they are simply not found.
  const pkg = await getPackage((await params).id)
  if (!pkg) notFound()
  const [building, report] = await Promise.all([
    getBuilding(pkg.buildingId),
    pkg.status === 'checked' ? getCheckReport(pkg.id) : null,
  ])
  if (!building) notFound()

  const billingPeriod = (pkg.confirmedFigures ?? pkg.extracted?.figures)?.building.billingPeriod ?? null
  const missing = unknownFacts(building.profile)
  const retry = extractStatementPackage.bind(null, pkg.id)
  const stuck = isExtractionStuck(pkg.status, pkg.updatedAt, new Date())

  return (
    <>
      <p><Link href={`/gebaeude/${building.id}`}>← {building.address.street}</Link></p>
      <h1>Abrechnungspaket {billingPeriod && formatBillingPeriod(billingPeriod)}</h1>
      <p className="muted">
        {building.address.street}, {building.address.postalCode} {building.address.city} · Versanddatum{' '}
        {formatDate(pkg.dispatchDate)} · {pkg.files.length}{' '}
        {pkg.files.length === 1 ? 'PDF-Datei' : 'PDF-Dateien'} · {PACKAGE_STATUS_LABELS[pkg.status]}
      </p>

      <PackageProgress status={pkg.status} />

      {pkg.status === 'uploaded' && (
        <div className="banner" role="status">
          <p>Die PDF-Dateien wurden hochgeladen, aber noch nicht ausgelesen.</p>
          <form action={retry}>
            <button type="submit">Jetzt auslesen</button>
          </form>
        </div>
      )}

      {pkg.status === 'extracting' && !stuck && (
        <div className="banner" role="status">
          Die Abrechnung wird ausgelesen …
          <AutoRefresh />
        </div>
      )}

      {(pkg.status === 'extraction_failed' || stuck) && (
        <div className="banner banner-out-of-scope" role="alert">
          <p>
            Die Abrechnung konnte nicht ausgelesen werden. Ihre PDF-Dateien sind gespeichert; Sie
            können das Auslesen erneut starten.
          </p>
          <form action={retry}>
            <button type="submit">Erneut auslesen</button>
          </form>
        </div>
      )}

      {pkg.status === 'awaiting_confirmation' && pkg.extracted && (
        <>
          {missing.length > 0 && (
            <div className="banner" role="note">
              <strong>Gebäudeprofil unvollständig:</strong> {missing.join(', ')}. Ergänzen Sie es{' '}
              <Link href={`/gebaeude/${building.id}`}>im Gebäude</Link> vor dem Bestätigen, damit
              weniger Prüfungen „nicht prüfbar“ sind.
            </div>
          )}
          <ConfirmForm
            action={confirmStatementPackage.bind(null, pkg.id)}
            extracted={pkg.extracted}
          />
        </>
      )}

      {report && <CheckReportView report={report} />}
    </>
  )
}
