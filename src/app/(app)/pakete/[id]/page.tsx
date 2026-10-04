import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { AutoRefresh } from '@/components/auto-refresh'
import { CheckReportView } from '@/components/check-report-view'
import { HistoryLink } from '@/components/history-link'
import { ConfirmForm } from '@/components/confirm-form'
import { PackageProgress } from '@/components/package-progress'
import { formatAddress, unknownFacts } from '@/lib/building-profile'
import { getBuilding } from '@/lib/buildings'
import { formatBillingPeriod, formatDate } from '@/lib/dates'
import { currentOf } from '@/lib/package-history'
import { isExtractionStuck, PACKAGE_STATUS_LABELS } from '@/lib/package-status'
import { getCheckReport, getPackage, getPdfLinks, listPackages } from '@/lib/statement-packages'
import { confirmStatementPackage, extractStatementPackage } from '../actions'

export const metadata: Metadata = { title: 'Abrechnungspaket – HeizCheck' }

type Props = { params: Promise<{ id: string }> }

export default async function PackagePage({ params }: Props) {
  // RLS hides other Organisations' packages, so they are simply not found.
  const pkg = await getPackage((await params).id)
  if (!pkg) notFound()
  const [building, report, pdfs, packages] = await Promise.all([
    getBuilding(pkg.buildingId),
    pkg.status === 'checked' ? getCheckReport(pkg.id) : null,
    pkg.status === 'awaiting_confirmation' ? getPdfLinks(pkg.id) : [],
    // Only a checked package can be superseded or have a history.
    pkg.status === 'checked' ? listPackages(pkg.buildingId) : [],
  ])
  if (!building) notFound()
  const summary = packages.find((p) => p.id === pkg.id)
  const current = summary && currentOf(packages, summary)

  const billingPeriod = (pkg.confirmedFigures ?? pkg.extracted?.figures)?.building.billingPeriod ?? null
  const missing = unknownFacts(building.profile)
  const retry = extractStatementPackage.bind(null, pkg.id)
  const stuck = isExtractionStuck(pkg.status, pkg.updatedAt, new Date())

  return (
    <>
      <p><Link href={`/gebaeude/${building.id}`}>← {building.address.street}</Link></p>
      <h1>Abrechnungspaket {billingPeriod && formatBillingPeriod(billingPeriod)}</h1>
      <p className="muted">
        {/* A Check Report keeps the address it was checked under. */}
        {formatAddress(report?.address ?? building.address)} · Versanddatum{' '}
        {formatDate(pkg.dispatchDate)} · {pkg.files.length}{' '}
        {pkg.files.length === 1 ? 'PDF-Datei' : 'PDF-Dateien'} · {PACKAGE_STATUS_LABELS[pkg.status]}
      </p>

      {current && current.id !== pkg.id ? (
        <div className="banner" role="note">
          <p>
            <strong>Ersetzt:</strong> Für diesen Abrechnungszeitraum wurde ein korrigiertes
            Abrechnungspaket bestätigt. Dieses Paket und sein Prüfbericht bleiben zur Nachverfolgung
            erhalten.
          </p>
          <p>
            <Link href={`/pakete/${current.id}`}>Aktuelles Paket ansehen</Link> ·{' '}
            <Link href={`/pakete/${pkg.id}/verlauf`}>Verlauf</Link>
          </p>
        </div>
      ) : (
        summary && <HistoryLink packages={packages} pkg={summary} />
      )}

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
              <strong>Gebäudeprofil unvollständig:</strong> {missing.join(', ')}. Diese Angaben
              stehen nicht in der Abrechnung, einzelne Prüfungen brauchen sie aber.{' '}
              <Link href={`/gebaeude/${building.id}#gebaeudeprofil`}>Gebäudeprofil ergänzen</Link>,
              dann hierher zurückkehren und bestätigen, damit weniger Prüfungen „nicht prüfbar“ sind.
            </div>
          )}
          <ConfirmForm
            action={confirmStatementPackage.bind(null, pkg.id)}
            extracted={pkg.extracted}
            pdfs={pdfs}
          />
        </>
      )}

      {report && <CheckReportView report={report} />}
    </>
  )
}
