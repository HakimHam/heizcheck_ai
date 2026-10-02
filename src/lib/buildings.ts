import 'server-only'
import { cache } from 'react'
import type { Address, BuildingInput, BuildingProfile, Co2Reduction } from './building-profile'
import { createClient } from './supabase/server'
import { isUuid } from './uuid'

export type Building = { id: string; address: Address; profile: BuildingProfile }

const COLUMNS =
  'id, street, postal_code, city, living_area_m2, heated_area_m2, mandatory_70_pct, residential, co2_reduction'

type Row = {
  id: string
  street: string
  postal_code: string
  city: string
  living_area_m2: number | null
  heated_area_m2: number | null
  mandatory_70_pct: boolean | null
  residential: boolean
  co2_reduction: Co2Reduction | null
}

const fromRow = (row: Row): Building => ({
  id: row.id,
  address: { street: row.street, postalCode: row.postal_code, city: row.city },
  profile: {
    livingAreaM2: row.living_area_m2 === null ? null : Number(row.living_area_m2),
    heatedAreaM2: row.heated_area_m2 === null ? null : Number(row.heated_area_m2),
    mandatory70Pct: row.mandatory_70_pct,
    residential: row.residential,
    co2Reduction: row.co2_reduction,
  },
})

const toRow = ({ address, profile }: BuildingInput) => ({
  street: address.street,
  postal_code: address.postalCode,
  city: address.city,
  living_area_m2: profile.livingAreaM2,
  heated_area_m2: profile.heatedAreaM2,
  mandatory_70_pct: profile.mandatory70Pct,
  residential: profile.residential,
  co2_reduction: profile.co2Reduction,
})

// Every query runs as the signed-in user, so RLS limits it to their
// Organisation's buildings.

export async function listBuildings(): Promise<Building[]> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('buildings')
    .select(COLUMNS)
    .order('city')
    .order('street')
  if (error) throw error
  return (data as Row[]).map(fromRow)
}

// Cached per request: the page and its metadata both read the building.
export const getBuilding = cache(async (id: string): Promise<Building | null> => {
  if (!isUuid(id)) return null
  const supabase = await createClient()
  const { data, error } = await supabase.from('buildings').select(COLUMNS).eq('id', id).maybeSingle()
  if (error) throw error
  return data && fromRow(data as Row)
})

export async function insertBuilding(building: BuildingInput): Promise<string> {
  const supabase = await createClient()
  const { data, error } = await supabase.from('buildings').insert(toRow(building)).select('id').single()
  if (error) throw error
  return data.id
}

/** Returns false when the building doesn't exist or belongs to another Organisation. */
export async function updateBuilding(id: string, building: BuildingInput): Promise<boolean> {
  if (!isUuid(id)) return false
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('buildings')
    .update(toRow(building))
    .eq('id', id)
    .select('id')
  if (error) throw error
  return data.length === 1
}
