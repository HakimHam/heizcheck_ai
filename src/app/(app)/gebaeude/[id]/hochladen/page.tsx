import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { OutOfScopeBanner } from '@/components/out-of-scope'
import { UploadForm } from '@/components/upload-form'
import { getBuilding } from '@/lib/buildings'
import { todayInGermany } from '@/lib/dates'

export const metadata: Metadata = { title: 'Abrechnungspaket hochladen – HeizCheck' }

type Props = { params: Promise<{ id: string }> }

export default async function UploadPage({ params }: Props) {
  const building = await getBuilding((await params).id)
  if (!building) notFound()

  return (
    <>
      <p><Link href={`/gebaeude/${building.id}`}>← {building.address.street}</Link></p>
      <h1>Abrechnungspaket hochladen</h1>
      {building.profile.residential ? (
        <>
          <p className="muted">
            Korrigiertes Paket vom Messdienstleister? Laden Sie es hier hoch. Sobald Sie die Werte
            bestätigen, ersetzt es das bisherige Paket für denselben Abrechnungszeitraum; das
            bisherige Paket und sein Prüfbericht bleiben erhalten.
          </p>
          <UploadForm buildingId={building.id} defaultDispatchDate={todayInGermany()} />
        </>
      ) : (
        <OutOfScopeBanner />
      )}
    </>
  )
}
