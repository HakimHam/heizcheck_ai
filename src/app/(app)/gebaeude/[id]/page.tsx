import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { BuildingForm } from '@/components/building-form'
import { OUT_OF_SCOPE_EXPLANATION } from '@/components/out-of-scope'
import { buildingFormValues } from '@/lib/building-form'
import { unknownFacts } from '@/lib/building-profile'
import { getBuilding } from '@/lib/buildings'
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

  return (
    <>
      <p><Link href="/">← Alle Gebäude</Link></p>
      <h1>{building.address.street}</h1>
      <p className="muted">{building.address.postalCode} {building.address.city}</p>

      {!building.profile.residential ? (
        <div className="banner banner-out-of-scope" role="note">
          <strong>Außerhalb des Prüfumfangs.</strong> {OUT_OF_SCOPE_EXPLANATION}
        </div>
      ) : (
        missing.length > 0 && (
          <div className="banner" role="note">
            <strong>Gebäudeprofil unvollständig:</strong> {missing.join(', ')}. Ohne diese Angaben sind
            einzelne Prüfungen nicht oder nur eingeschränkt möglich.
          </div>
        )
      )}

      <section className="stack">
        <h2>Abrechnungszeiträume</h2>
        <div className="empty">
          <p>Für dieses Gebäude wurden noch keine Abrechnungspakete hochgeladen.</p>
        </div>
      </section>

      <BuildingForm
        action={saveBuilding.bind(null, building.id)}
        initialValues={buildingFormValues(building)}
        submitLabel="Speichern"
      />
    </>
  )
}
