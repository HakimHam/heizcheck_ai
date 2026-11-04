import Link from 'next/link'
import { unknownFacts } from '@/lib/building-profile'
import { listBuildings } from '@/lib/buildings'
import { OutOfScopeBadge } from '@/components/out-of-scope'
import { CheckReportSummary } from '@/components/check-report-summary'
import { TodayDate } from '@/components/today-date'
import { formatBillingPeriod } from '@/lib/dates'
import { currentPackages } from '@/lib/package-history'
import { listPackages, type PackageSummary } from '@/lib/statement-packages'

export const metadata = { title: 'Gebäude – HeizCheck' }

export default async function BuildingsPage() {
  const [buildings, packages] = await Promise.all([listBuildings(), listPackages()])
  // Current packages only, newest first, so a building's first checked package
  // has its latest Check Report and a corrected package hides the one it replaced.
  const current = currentPackages(packages)
  const packagesOf = (id: string) => current.filter((pkg) => pkg.buildingId === id)

  return (
    <>
      <div className="page-title">
        <h1>Gebäude</h1>
        <TodayDate />
        <Link href="/gebaeude/neu" className="button">Gebäude anlegen</Link>
      </div>
      {buildings.length === 0 ? (
        <div className="empty">
          <p>Sie haben noch keine Gebäude angelegt.</p>
        </div>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Gebäude</th>
              <th>Abrechnungszeiträume</th>
              <th>Letzter Prüfbericht</th>
            </tr>
          </thead>
          <tbody>
            {buildings.map(({ id, address, profile }) => (
              <tr key={id}>
                <td>
                  <Link href={`/gebaeude/${id}`}>{address.street}</Link>
                  <div className="muted">{address.postalCode} {address.city}</div>
                  {!profile.residential ? (
                    <OutOfScopeBadge />
                  ) : (
                    unknownFacts(profile).length > 0 && (
                      <span className="badge">Gebäudeprofil unvollständig</span>
                    )
                  )}
                </td>
                <td>
                  <BillingPeriods packages={packagesOf(id)} />
                </td>
                <td>
                  <LatestReport packages={packagesOf(id)} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  )
}

function BillingPeriods({ packages }: { packages: PackageSummary[] }) {
  const periods = [...new Set(packages.map((pkg) => formatBillingPeriod(pkg.billingPeriod)))]
  if (periods.length === 0) return <span className="muted">Noch keine</span>
  return (
    <ul className="plain">
      {periods.map((period) => (
        <li key={period}>{period}</li>
      ))}
    </ul>
  )
}

function LatestReport({ packages }: { packages: PackageSummary[] }) {
  const latest = packages.find((pkg) => pkg.results !== null)
  if (!latest) return <span className="muted">Noch keiner</span>
  return (
    <Link href={`/pakete/${latest.id}`}>
      <CheckReportSummary results={latest.results} />
    </Link>
  )
}
