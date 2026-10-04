import Link from 'next/link'
import { historyOf } from '@/lib/package-history'
import type { PackageSummary } from '@/lib/statement-packages'

/** A link to the correction history of `pkg`, if it has one. */
export function HistoryLink({ packages, pkg }: { packages: PackageSummary[]; pkg: PackageSummary }) {
  const count = historyOf(packages, pkg).length
  if (count < 2) return null
  return (
    <div className="muted">
      <Link href={`/pakete/${pkg.id}/verlauf`}>Korrigiert · Verlauf ({count} Pakete)</Link>
    </div>
  )
}
