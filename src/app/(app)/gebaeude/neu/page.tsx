import Link from 'next/link'
import { BuildingForm } from '@/components/building-form'
import { createBuilding } from '../actions'

export const metadata = { title: 'Gebäude anlegen – HeizCheck' }

export default function NewBuildingPage() {
  return (
    <>
      <p><Link href="/">← Alle Gebäude</Link></p>
      <h1>Gebäude anlegen</h1>
      <BuildingForm action={createBuilding} submitLabel="Gebäude anlegen" />
    </>
  )
}
