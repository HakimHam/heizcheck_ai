import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createTestDatabase, type TestDatabase } from './test-database'

let database: TestDatabase
let alice: string
let building: string

type Db = TestDatabase['db']

// When the job runs in these tests. Every age below counts back from here.
const NOW = new Date('2030-10-07T03:00:00Z')
const FOUR_YEARS_AGO = '2026-10-07T03:00:00Z'
const SECOND = 1000
const shift = (iso: string, ms: number) => new Date(Date.parse(iso) + ms).toISOString()

const PROFILE = { livingAreaM2: 812.45, heatedAreaM2: 790.5, mandatory70Pct: null, residential: true, co2Reduction: null }
const confirmedFor = (billingPeriod: object | null) => ({ building: { totalCostCents: 300_016, billingPeriod }, units: [] })
const PERIOD_2025 = { start: '2025-01-01', end: '2025-12-31' }

/** Uploads a package with one PDF, and returns its id and the PDF's storage path. */
async function upload(db: Db) {
  const id = (
    await db.query<{ id: string }>(
      `insert into statement_packages (building_id, dispatch_date) values ($1, '2026-10-02') returning id`,
      [building],
    )
  ).rows[0].id
  const path = (
    await db.query<{ storage_path: string }>(
      `insert into statement_package_files (statement_package_id, position, file_name, size_bytes)
       values ($1, 1, 'Gesamtabrechnung.pdf', 1200) returning storage_path`,
      [id],
    )
  ).rows[0].storage_path
  return { id, path }
}

/** Runs an uploaded package through extraction and confirmation, which stores its Check Report. */
async function confirm(db: Db, id: string, billingPeriod: object | null = null) {
  await db.query(`update statement_packages set status = 'extracting' where id = $1`, [id])
  await db.query(
    `update statement_packages
        set status = 'awaiting_confirmation', extracted_figures = '{}', extracted_sources = '{}'
      where id = $1`,
    [id],
  )
  await db.query('select confirm_statement_package($1, $2, $3, $4, $5)', [
    id,
    JSON.stringify(confirmedFor(billingPeriod)),
    JSON.stringify(PROFILE),
    '0.1.0',
    JSON.stringify([{ rule: 'C1', status: 'passed' }]),
  ])
}

/** Uploads a package and runs it through to checked, with its Check Report. */
async function checked(db: Db, billingPeriod: object | null = null) {
  const pkg = await upload(db)
  await confirm(db, pkg.id, billingPeriod)
  return pkg
}

/** Backdates a package and its Check Report, bypassing the triggers that keep created_at fixed. */
async function backdate(id: string, packageAt: string, reportAt: string = packageAt) {
  await database.db.exec('set session_replication_role = replica')
  try {
    await database.db.query('update statement_packages set created_at = $2 where id = $1', [id, packageAt])
    await database.db.query('update check_reports set created_at = $2 where statement_package_id = $1', [
      id,
      reportAt,
    ])
  } finally {
    await database.db.exec('set session_replication_role = origin')
  }
}

const expiredFiles = (at = NOW) =>
  database.asServiceRole((db) =>
    db
      .query<{ paths: string[] }>('select expired_statement_package_files($1) as paths', [at.toISOString()])
      .then((r) => r.rows[0].paths),
  )

const deleteExpired = (at = NOW) =>
  database.asServiceRole((db) =>
    db
      .query<{ deleted: number }>('select delete_expired_statement_packages($1) as deleted', [at.toISOString()])
      .then((r) => r.rows[0].deleted),
  )

const remaining = async () => {
  const ids = (table: string, column: string) =>
    database.db.query<{ id: string }>(`select ${column} as id from ${table} order by 1`).then((r) => r.rows.map((row) => row.id))
  return {
    packages: await ids('statement_packages', 'id'),
    files: await ids('statement_package_files', 'statement_package_id'),
    reports: await ids('check_reports', 'statement_package_id'),
  }
}

beforeEach(async () => {
  database = await createTestDatabase()
  alice = await database.signUp('alice@hv-mueller.de', 'Hausverwaltung Müller')
  building = await database.asUser(alice, (db) =>
    db
      .query<{ id: string }>(
        `insert into buildings (street, postal_code, city, residential, living_area_m2, heated_area_m2)
         values ('Lindenstraße 5', '10115', 'Berlin', true, 812.45, 790.5) returning id`,
      )
      .then((r) => r.rows[0].id),
  )
})

afterEach(() => database.db.close())

describe('the retention job', () => {
  it('deletes a package, its PDFs and its Check Report at exactly 4 years, not a second before', async () => {
    const [exactly, justUnder, justOver] = await database.asUser(alice, async (db) => [
      await checked(db),
      await checked(db),
      await checked(db),
    ])
    await backdate(exactly.id, FOUR_YEARS_AGO)
    await backdate(justUnder.id, shift(FOUR_YEARS_AGO, SECOND))
    await backdate(justOver.id, shift(FOUR_YEARS_AGO, -SECOND))

    expect(await expiredFiles()).toEqual([exactly.path, justOver.path].sort())
    expect(await deleteExpired()).toBe(2)
    expect(await remaining()).toEqual({ packages: [justUnder.id], files: [justUnder.id], reports: [justUnder.id] })
  })

  it('deletes packages that were never checked, by their upload date', async () => {
    const [old, young] = await database.asUser(alice, async (db) => [await upload(db), await upload(db)])
    await backdate(old.id, shift(FOUR_YEARS_AGO, -SECOND))
    await backdate(young.id, shift(FOUR_YEARS_AGO, SECOND))

    expect(await expiredFiles()).toEqual([old.path])
    expect(await deleteExpired()).toBe(1)
    expect((await remaining()).packages).toEqual([young.id])
  })

  it('keeps a Check Report its full 4 years, with its package, however old the upload', async () => {
    const [exactly, justUnder, justOver] = await database.asUser(alice, async (db) => [
      await checked(db),
      await checked(db),
      await checked(db),
    ])
    // Uploaded long ago, confirmed only around 4 years before the run.
    await backdate(exactly.id, '2025-01-01T00:00:00Z', FOUR_YEARS_AGO)
    await backdate(justUnder.id, '2025-01-01T00:00:00Z', shift(FOUR_YEARS_AGO, SECOND))
    await backdate(justOver.id, '2025-01-01T00:00:00Z', shift(FOUR_YEARS_AGO, -SECOND))

    expect(await expiredFiles()).toEqual([exactly.path, justOver.path].sort())
    expect(await deleteExpired()).toBe(2)
    expect((await remaining()).reports).toEqual([justUnder.id])
  })

  it('keeps a correction as long as a package it superseded is kept', async () => {
    // `earlier` is superseded by `correction`, the newer upload, but was
    // confirmed later, so its Check Report is younger.
    const [earlier, correction] = await database.asUser(alice, async (db) => [await upload(db), await checked(db, PERIOD_2025)])
    await database.asUser(alice, (db) => confirm(db, earlier.id, PERIOD_2025))
    const supersededBy = await database.db
      .query<{ superseded_by: string }>('select superseded_by from statement_packages where id = $1', [earlier.id])
      .then((r) => r.rows[0].superseded_by)
    expect(supersededBy).toBe(correction.id)

    await backdate(earlier.id, '2025-01-01T00:00:00Z', shift(FOUR_YEARS_AGO, SECOND))
    await backdate(correction.id, '2025-01-02T00:00:00Z')

    expect(await deleteExpired()).toBe(0)
    expect((await remaining()).packages).toHaveLength(2)

    // Once the superseded package expires too, both go together.
    expect(await deleteExpired(new Date(Date.parse(NOW.toISOString()) + 2 * SECOND))).toBe(2)
    expect(await remaining()).toEqual({ packages: [], files: [], reports: [] })
  })

  it('runs only as the service role', async () => {
    await database.asUser(alice, (db) => checked(db))
    await expect(
      database.asUser(alice, (db) => db.query('select delete_expired_statement_packages($1)', [NOW.toISOString()])),
    ).rejects.toThrow(/permission denied/)
    await expect(
      database.asUser(alice, (db) => db.query('select expired_statement_package_files($1)', [NOW.toISOString()])),
    ).rejects.toThrow(/permission denied/)
  })
})

describe('Check Reports', () => {
  it('are not stored for a package uploaded 4 years ago, whose PDFs the job may already have removed', async () => {
    // Confirming runs on the database clock, so these ages count back from
    // the real now, with a margin either side of the 4 years.
    const [justUnder, justOver] = await database.asUser(alice, async (db) => [await upload(db), await upload(db)])
    const fourYearsBeforeNow = await database.db
      .query<{ at: Date }>(`select now() - interval '4 years' as at`)
      .then((r) => r.rows[0].at.toISOString())
    await backdate(justUnder.id, shift(fourYearsBeforeNow, 60 * SECOND))
    await backdate(justOver.id, shift(fourYearsBeforeNow, -60 * SECOND))

    await database.asUser(alice, (db) => confirm(db, justUnder.id))
    await expect(database.asUser(alice, (db) => confirm(db, justOver.id))).rejects.toThrow(/has expired/)
    expect((await remaining()).reports).toEqual([justUnder.id])
  })

  it('are deleted by nothing but the retention job', async () => {
    const pkg = await database.asUser(alice, (db) => checked(db))
    const deleteReport = (db: Db) => db.query('delete from check_reports where statement_package_id = $1', [pkg.id])

    await expect(database.asUser(alice, deleteReport)).rejects.toThrow()
    await expect(database.asServiceRole(deleteReport)).rejects.toThrow(/only by the retention job/)
    await expect(deleteReport(database.db)).rejects.toThrow(/only by the retention job/)
    await expect(database.db.query('delete from organisations')).rejects.toThrow(/only by the retention job/)
    expect((await remaining()).reports).toEqual([pkg.id])
  })
})
