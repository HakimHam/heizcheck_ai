import Link from 'next/link'
import { unknownFacts } from '@/lib/building-profile'
import { listBuildings } from '@/lib/buildings'
import { OutOfScopeBadge } from '@/components/out-of-scope'

export const metadata = { title: 'Gebäude – HeizCheck' }

export default async function BuildingsPage() {
  const buildings = await listBuildings()

  return (
    <>
      <div className="page-title">
        <h1>Gebäude</h1>
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
                {/* Filled in once Statement Packages and Check Reports exist (ticket 03). */}
                <td className="muted">Noch keine</td>
                <td className="muted">Noch keiner</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  )
}
