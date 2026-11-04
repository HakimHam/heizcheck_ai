import 'server-only'
import { cache } from 'react'
import { OUT_OF_SCOPE_EXPLANATION } from '@/components/out-of-scope'
import type { Address, BuildingProfile } from './building-profile'
import { getBuilding } from './buildings'
import { checkPackage, type CheckResult } from './check-engine'
import { appExtractor, type Extractor } from './extractor'
import type { BillingPeriod, ExtractedFigures, Figures, IsoDate } from './figures'
import { EXTRACTION_TIMEOUT_MS, type PackageStatus } from './package-status'
import { createClient } from './supabase/server'
import { PDF_BUCKET, PDF_SIGNATURE_BYTES, pdfProblem, uploadProblem, type UploadRequest } from './upload'
import { isUuid } from './uuid'

// The Statement Package service: upload, extraction, confirmation and the
// Check Report. Every query runs as the signed-in user, so RLS limits it to
// their Organisation; the database enforces the lifecycle order.

export type StatementPackage = {
  id: string
  buildingId: string
  dispatchDate: IsoDate
  status: PackageStatus
  extracted: ExtractedFigures | null
  confirmedFigures: Figures | null
  files: { position: number; fileName: string }[]
  /** The corrected package that replaced this one, or null if it is current. */
  supersededBy: string | null
  createdAt: string
  updatedAt: string
}

export type CheckReport = {
  id: string
  statementPackageId: string
  rulesetVersion: string
  dispatchDate: IsoDate
  confirmedFigures: Figures
  buildingProfile: BuildingProfile
  /** The building's address when checked. */
  address: Address
  results: CheckResult[]
  createdAt: string
}

/** A package as listed for a building, with its Check Report's results once checked. */
export type PackageSummary = {
  id: string
  buildingId: string
  billingPeriod: BillingPeriod | null
  dispatchDate: IsoDate
  status: PackageStatus
  supersededBy: string | null
  createdAt: string
  results: CheckResult[] | null
}

export type Registration =
  | { ok: true; packageId: string; uploads: { path: string; token: string }[] }
  | { ok: false; error: string }

/**
 * Registers a new Statement Package and returns one signed upload per PDF, in
 * order. The browser uploads straight to storage, so large packages don't
 * pass through the app server.
 */
export async function registerPackage(
  buildingId: string,
  request: UploadRequest,
): Promise<Registration> {
  const problem = uploadProblem(request)
  if (problem) return { ok: false, error: problem }

  const building = await getBuilding(buildingId)
  if (!building) return { ok: false, error: 'Das Gebäude wurde nicht gefunden.' }
  if (!building.profile.residential) return { ok: false, error: OUT_OF_SCOPE_EXPLANATION }

  const supabase = await createClient()
  const { data: pkg, error } = await supabase
    .from('statement_packages')
    .insert({ building_id: buildingId, dispatch_date: request.dispatchDate })
    .select('id')
    .single()
  if (error) throw error

  const { data: files, error: filesError } = await supabase
    .from('statement_package_files')
    .insert(
      request.files.map((file, i) => ({
        statement_package_id: pkg.id,
        position: i + 1,
        file_name: file.name,
        size_bytes: file.size,
      })),
    )
    .select('position, storage_path')
    .order('position')
  if (filesError) throw filesError

  const uploads = await Promise.all(
    files.map(async ({ storage_path }) => {
      const { data, error } = await supabase.storage
        .from(PDF_BUCKET)
        .createSignedUploadUrl(storage_path)
      if (error) throw error
      return { path: data.path, token: data.token }
    }),
  )
  return { ok: true, packageId: pkg.id, uploads }
}

/**
 * Reads the package's PDFs into Extracted Figures. Runs from `uploaded` (the
 * first time), `extraction_failed` (a retry) or an extraction stuck for longer
 * than `EXTRACTION_TIMEOUT_MS`; any other state is left alone, so a double
 * submit doesn't extract twice. Any failure, including a PDF that never
 * finished uploading or isn't really a PDF, leaves it `extraction_failed`.
 */
export async function extractPackage(packageId: string, extractor?: Extractor) {
  if (!isUuid(packageId)) return
  const supabase = await createClient()
  const { data: started, error } = await supabase
    .from('statement_packages')
    .update({ status: 'extracting' })
    .eq('id', packageId)
    .or(
      `status.in.(uploaded,extraction_failed),and(status.eq.extracting,updated_at.lt.${new Date(
        Date.now() - EXTRACTION_TIMEOUT_MS,
      ).toISOString()})`,
    )
    .select('id')
  if (error) throw error
  if (started.length === 0) return

  let extracted: ExtractedFigures
  try {
    const { data: files, error } = await supabase
      .from('statement_package_files')
      .select('file_name, storage_path')
      .eq('statement_package_id', packageId)
      .order('position')
    if (error) throw error
    const pdfs = await Promise.all(
      files.map(async (file) => {
        const { data, error } = await supabase.storage.from(PDF_BUCKET).download(file.storage_path)
        if (error) throw error
        const bytes = new Uint8Array(await data.arrayBuffer())
        // The browser checked this too, but can't be trusted.
        const problem = pdfProblem(
          { name: file.file_name, size: bytes.length },
          bytes.subarray(0, PDF_SIGNATURE_BYTES),
        )
        if (problem) throw new Error(problem)
        return { fileName: file.file_name, bytes }
      }),
    )
    // Chosen here, so a misconfigured Extractor fails the extraction instead of leaving it stuck.
    extracted = await (extractor ?? appExtractor()).extract(pdfs)
  } catch (cause) {
    console.error(`Extraction of Statement Package ${packageId} failed`, cause)
    await markExtractionFailed(packageId)
    return
  }

  const { error: saveError } = await supabase
    .from('statement_packages')
    .update({
      status: 'awaiting_confirmation',
      extracted_figures: extracted.figures,
      extracted_sources: extracted.sources,
    })
    .eq('id', packageId)
  if (saveError) {
    console.error(`Saving the figures of Statement Package ${packageId} failed`, saveError)
    await markExtractionFailed(packageId)
  }
}

/** Unless another run has finished the extraction in the meantime. */
async function markExtractionFailed(packageId: string) {
  const supabase = await createClient()
  const { error } = await supabase
    .from('statement_packages')
    .update({ status: 'extraction_failed' })
    .eq('id', packageId)
    .eq('status', 'extracting')
  if (error) throw error
}

/**
 * Confirms the figures for the whole package, runs the check engine on them
 * and stores the Check Report. Does nothing if the package isn't awaiting
 * confirmation (e.g. it was confirmed in another tab); throws if that happens
 * while this runs.
 */
export async function confirmPackage(packageId: string, figures: Figures) {
  const pkg = await getPackage(packageId)
  if (!pkg || pkg.status !== 'awaiting_confirmation') return
  const building = await getBuilding(pkg.buildingId)
  if (!building) return

  const report = checkPackage({
    confirmedFigures: figures,
    buildingProfile: building.profile,
    dispatchDate: pkg.dispatchDate,
  })
  const supabase = await createClient()
  const { error } = await supabase.rpc('confirm_statement_package', {
    p_package_id: packageId,
    p_confirmed_figures: figures,
    p_building_profile: building.profile,
    p_ruleset_version: report.rulesetVersion,
    p_results: report.results,
  })
  if (error) throw error
}

type PackageRow = {
  id: string
  building_id: string
  dispatch_date: string
  status: PackageStatus
  extracted_figures: Figures | null
  extracted_sources: ExtractedFigures['sources'] | null
  confirmed_figures: Figures | null
  superseded_by: string | null
  created_at: string
  updated_at: string
  statement_package_files: { position: number; file_name: string }[]
}

export const getPackage = cache(async (id: string): Promise<StatementPackage | null> => {
  if (!isUuid(id)) return null
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('statement_packages')
    .select(
      'id, building_id, dispatch_date, status, extracted_figures, extracted_sources, confirmed_figures, superseded_by, created_at, updated_at, statement_package_files (position, file_name)',
    )
    .eq('id', id)
    .maybeSingle()
  if (error) throw error
  if (!data) return null
  const row = data as PackageRow
  return {
    id: row.id,
    buildingId: row.building_id,
    dispatchDate: row.dispatch_date,
    status: row.status,
    extracted:
      row.extracted_figures && row.extracted_sources
        ? { figures: row.extracted_figures, sources: row.extracted_sources }
        : null,
    confirmedFigures: row.confirmed_figures,
    files: row.statement_package_files
      .map((f) => ({ position: f.position, fileName: f.file_name }))
      .sort((a, b) => a.position - b.position),
    supersededBy: row.superseded_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
})

/** A PDF of a package with a short-lived link to read it in the browser. */
export type PdfLink = { position: number; fileName: string; url: string }

const PDF_LINK_SECONDS = 60 * 60

/** Links to the package's PDFs, in order, for showing them next to the figures. */
export async function getPdfLinks(packageId: string): Promise<PdfLink[]> {
  if (!isUuid(packageId)) return []
  const supabase = await createClient()
  const { data: files, error } = await supabase
    .from('statement_package_files')
    .select('position, file_name, storage_path')
    .eq('statement_package_id', packageId)
    .order('position')
  if (error) throw error
  if (files.length === 0) return []
  const { data: links, error: linkError } = await supabase.storage
    .from(PDF_BUCKET)
    .createSignedUrls(
      files.map((file) => file.storage_path),
      PDF_LINK_SECONDS,
    )
  if (linkError) throw linkError
  return files.flatMap((file, i) => {
    const url = links[i]?.signedUrl
    if (!url) console.error(`No link to PDF ${file.storage_path}`, links[i]?.error)
    return url ? [{ position: file.position, fileName: file.file_name, url }] : []
  })
}

export async function getCheckReport(packageId: string): Promise<CheckReport | null> {
  if (!isUuid(packageId)) return null
  const supabase = await createClient()
  const { data, error } = await supabase
    .from('check_reports')
    .select(
      'id, statement_package_id, ruleset_version, dispatch_date, confirmed_figures, building_profile, address, results, created_at',
    )
    .eq('statement_package_id', packageId)
    .maybeSingle()
  if (error) throw error
  return (
    data && {
      id: data.id,
      statementPackageId: data.statement_package_id,
      rulesetVersion: data.ruleset_version,
      dispatchDate: data.dispatch_date,
      confirmedFigures: data.confirmed_figures,
      buildingProfile: data.building_profile,
      address: data.address,
      results: data.results,
      createdAt: data.created_at,
    }
  )
}

type SummaryRow = {
  id: string
  building_id: string
  dispatch_date: string
  status: PackageStatus
  superseded_by: string | null
  created_at: string
  extracted_period: BillingPeriod | null
  confirmed_period: BillingPeriod | null
  check_reports: { results: CheckResult[] } | { results: CheckResult[] }[] | null
}

/** Packages, newest first: all of the Organisation's, or one building's. */
export async function listPackages(buildingId?: string): Promise<PackageSummary[]> {
  const supabase = await createClient()
  let query = supabase
    .from('statement_packages')
    .select(
      'id, building_id, dispatch_date, status, superseded_by, created_at, extracted_period:extracted_figures->building->billingPeriod, confirmed_period:confirmed_figures->building->billingPeriod, check_reports (results)',
    )
    .order('created_at', { ascending: false })
  if (buildingId) {
    if (!isUuid(buildingId)) return []
    query = query.eq('building_id', buildingId)
  }
  const { data, error } = await query
  if (error) throw error
  return (data as unknown as SummaryRow[]).map((row) => {
    const report = Array.isArray(row.check_reports) ? row.check_reports[0] : row.check_reports
    return {
      id: row.id,
      buildingId: row.building_id,
      billingPeriod: row.confirmed_period ?? row.extracted_period,
      dispatchDate: row.dispatch_date,
      status: row.status,
      supersededBy: row.superseded_by,
      createdAt: row.created_at,
      results: report?.results ?? null,
    }
  })
}
