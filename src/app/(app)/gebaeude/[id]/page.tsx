import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { BuildingForm } from '@/components/building-form'
import { OutOfScopeBanner } from '@/components/out-of-scope'
import { buildingFormValues } from '@/lib/building-form'
import { unknownFacts } from '@/lib/building-profile'
import { getBuilding } from '@/lib/buildings'
import { formatBillingPeriod, formatDate } from '@/lib/dates'
import { PACKAGE_STATUS_LABELS } from '@/lib/package-status'
import { CheckReportSummary } from '@/components/check-report-summary'
import { listPackages } from '@/lib/statement-packages'
import { saveBuilding } from '../actions'

type Props = { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const building = await getBuilding((await params).id)
  return { title: `${building?.address.street ?? 'Gebäude'} – HeizCheck` }
}

export default async function BuildingPage({ params }: Props) {
  const { id } = await params
  // RLS hides other Organisations' buildings, so they are simply not found.
  const building = await getBuilding(id)
  if (!building) notFound()

  const missing = unknownFacts(building.profile)
  const packages = await listPackages(building.id)

  return (
    <>
      <p><Link href="/">← Alle Gebäude</Link></p>
      <h1>{building.address.street}</h1>
      <p className="muted">{building.address.postalCode} {building.address.city}</p>

      {!building.profile.residential ? (
        <OutOfScopeBanner />
      ) : (
        missing.length > 0 && (
          <div className="banner" role="note">
            <strong>Gebäudeprofil unvollständig:</strong> {missing.join(', ')}. Ohne diese Angaben sind
            einzelne Prüfungen nicht oder nur eingeschränkt möglich.
          </div>
        )
      )}

      <section className="stack">
        <div className="page-title">
          <h2>Abrechnungspakete</h2>
          {building.profile.residential && (
            <Link href={`/gebaeude/${building.id}/hochladen`} className="button">
              Abrechnungspaket hochladen
            </Link>
          )}
        </div>
        {packages.length === 0 ? (
          <div className="empty">
            <p>Für dieses Gebäude wurden noch keine Abrechnungspakete hochgeladen.</p>
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Abrechnungszeitraum</th>
                <th>Versanddatum</th>
                <th>Stand</th>
                <th>Prüfbericht</th>
              </tr>
            </thead>
            <tbody>
              {packages.map((pkg) => (
                <tr key={pkg.id}>
                  <td>
                    <Link href={`/pakete/${pkg.id}`}>{formatBillingPeriod(pkg.billingPeriod)}</Link>
                  </td>
                  <td>{formatDate(pkg.dispatchDate)}</td>
                  <td>{PACKAGE_STATUS_LABELS[pkg.status]}</td>
                  <td><CheckReportSummary results={pkg.results} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section id="gebaeudeprofil">
        <BuildingForm
          action={saveBuilding.bind(null, building.id)}
          initialValues={buildingFormValues(building)}
          submitLabel="Speichern"
        />
      </section>
    </>
  )
}
