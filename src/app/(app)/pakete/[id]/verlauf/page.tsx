import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { CheckReportSummary } from '@/components/check-report-summary'
import { formatAddress } from '@/lib/building-profile'
import { getBuilding } from '@/lib/buildings'
import { formatCreatedAt } from '@/lib/check-report'
import { formatBillingPeriod, formatDate } from '@/lib/dates'
import { currentOf, historyOf } from '@/lib/package-history'
import { PACKAGE_STATUS_LABELS } from '@/lib/package-status'
import { getPackage, listPackages } from '@/lib/statement-packages'

export const metadata: Metadata = { title: 'Verlauf – HeizCheck' }

type Props = { params: Promise<{ id: string }> }

// Every package and Check Report for a building and Billing Period, oldest
// first: the original and each correction the Metering Provider sent.
export default async function HistoryPage({ params }: Props) {
  // RLS hides other Organisations' packages, so they are simply not found.
  const statementPackage = await getPackage((await params).id)
  if (!statementPackage) notFound()
  const [building, packages] = await Promise.all([
    getBuilding(statementPackage.buildingId),
    listPackages(statementPackage.buildingId),
  ])
  const pkg = packages.find((p) => p.id === statementPackage.id)
  if (!building || !pkg) notFound()

  const current = currentOf(packages, pkg)
  const history = historyOf(packages, pkg)

  return (
    <>
      <p><Link href={`/pakete/${current.id}`}>← Aktuelles Paket</Link></p>
      <h1>Verlauf {formatBillingPeriod(current.billingPeriod)}</h1>
      <p className="muted">{formatAddress(building.address)}</p>
      <table className="table">
        <thead>
          <tr>
            <th>Hochgeladen am</th>
            <th>Versanddatum</th>
            <th>Stand</th>
            <th>Prüfbericht</th>
          </tr>
        </thead>
        <tbody>
          {history.map((p) => (
            <tr key={p.id}>
              <td>
                <Link href={`/pakete/${p.id}`}>{formatCreatedAt(p.createdAt)}</Link>
              </td>
              <td>{formatDate(p.dispatchDate)}</td>
              <td>
                {PACKAGE_STATUS_LABELS[p.status]}
                <div className="muted">{p.id === current.id ? 'Aktuell' : 'Ersetzt'}</div>
              </td>
              <td><CheckReportSummary results={p.results} /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  )
}
