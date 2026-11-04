import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createTestDatabase, type TestDatabase } from './test-database'

let database: TestDatabase
let alice: string
let bob: string
let building: string

type Db = TestDatabase['db']

const FIGURES = { building: { totalCostCents: 300_000 }, units: [] }
const CONFIRMED = { building: { totalCostCents: 300_016 }, units: [] }
// The Building Profile of the building `createBuilding` makes, as the app reads it.
const PROFILE = {
  livingAreaM2: 812.45,
  heatedAreaM2: 790.5,
  mandatory70Pct: null,
  residential: true,
  co2Reduction: null,
}
const RESULTS = [{ rule: 'C1', status: 'passed' }]

const createBuilding = (db: Db, residential = true) =>
  db
    .query<{ id: string }>(
      `insert into buildings (street, postal_code, city, residential, living_area_m2, heated_area_m2)
       values ('Lindenstraße 5', '10115', 'Berlin', $1, 812.45, 790.5) returning id`,
      [residential],
    )
    .then((r) => r.rows[0].id)

const ADDRESS = { street: 'Lindenstraße 5', postalCode: '10115', city: 'Berlin' }
const PERIOD_2025 = { start: '2025-01-01', end: '2025-12-31' }
const PERIOD_2024 = { start: '2024-01-01', end: '2024-12-31' }
const confirmedFor = (billingPeriod: object | null) => ({
  building: { ...CONFIRMED.building, billingPeriod },
  units: [],
})

const createPackage = (db: Db, buildingId = building) =>
  db
    .query<{ id: string }>(
      `insert into statement_packages (building_id, dispatch_date) values ($1, '2026-10-02') returning id`,
      [buildingId],
    )
    .then((r) => r.rows[0].id)

const statusOf = (db: Db, id: string) =>
  db
    .query<{ status: string }>('select status from statement_packages where id = $1', [id])
    .then((r) => r.rows[0]?.status)

const setStatus = (db: Db, id: string, status: string, extra = '') =>
  db.query(`update statement_packages set status = $2 ${extra} where id = $1`, [id, status])

/** Runs a package through extraction to awaiting_confirmation. */
async function extracted(db: Db, buildingId = building) {
  const id = await createPackage(db, buildingId)
  await setStatus(db, id, 'extracting')
  await db.query(
    `update statement_packages
        set status = 'awaiting_confirmation', extracted_figures = $2, extracted_sources = '{}'
      where id = $1`,
    [id, JSON.stringify(FIGURES)],
  )
  return id
}

const confirm = (db: Db, id: string, profile: object = PROFILE, figures: object = CONFIRMED) =>
  db
    .query<{ id: string }>(
      'select confirm_statement_package($1, $2, $3, $4, $5) as id',
      [id, JSON.stringify(figures), JSON.stringify(profile), '0.1.0', JSON.stringify(RESULTS)],
    )
    .then((r) => r.rows[0].id)

beforeEach(async () => {
  database = await createTestDatabase()
  alice = await database.signUp('alice@hv-mueller.de', 'Hausverwaltung Müller')
  bob = await database.signUp('bob@hv-schmidt.de', 'Hausverwaltung Schmidt')
  building = await database.asUser(alice, (db) => createBuilding(db))
})

afterEach(() => database.db.close())

describe('Statement Package upload', () => {
  it('accepts a package for a residential building, starting as uploaded', async () => {
    const id = await database.asUser(alice, (db) => createPackage(db))
    expect(await database.asUser(alice, (db) => statusOf(db, id))).toBe('uploaded')
  })

  it('refuses a package for a non-residential building', async () => {
    await expect(
      database.asUser(alice, async (db) => createPackage(db, await createBuilding(db, false))),
    ).rejects.toThrow(/out of scope/)
  })

  it("refuses a package for another Organisation's building", async () => {
    await expect(database.asUser(bob, (db) => createPackage(db))).rejects.toThrow()
  })

  it('stores each PDF under the Organisation and package, and only while uploading', async () => {
    const { id, organisationId } = await database.asUser(alice, async (db) => ({
      id: await createPackage(db),
      organisationId: (await db.query<{ id: string }>('select id from organisations')).rows[0].id,
    }))
    const path = await database.asUser(alice, (db) =>
      db
        .query<{ storage_path: string }>(
          `insert into statement_package_files (statement_package_id, position, file_name, size_bytes)
           values ($1, 1, 'Gesamtabrechnung.pdf', 1200) returning storage_path`,
          [id],
        )
        .then((r) => r.rows[0].storage_path),
    )
    expect(path).toBe(`${organisationId}/${id}/1.pdf`)

    await database.asUser(alice, (db) => setStatus(db, id, 'extracting'))
    await expect(
      database.asUser(alice, (db) =>
        db.query(
          `insert into statement_package_files (statement_package_id, position, file_name, size_bytes)
           values ($1, 2, 'Nachzügler.pdf', 1200)`,
          [id],
        ),
      ),
    ).rejects.toThrow()
  })

  it('lets members upload PDFs only to registered paths in their own Organisation', async () => {
    const id = await database.asUser(alice, (db) => createPackage(db))
    const path = await database.asUser(alice, (db) =>
      db
        .query<{ storage_path: string }>(
          `insert into statement_package_files (statement_package_id, position, file_name, size_bytes)
           values ($1, 1, 'a.pdf', 1200) returning storage_path`,
          [id],
        )
        .then((r) => r.rows[0].storage_path),
    )
    const upload = (user: string, name: string) =>
      database.asUser(user, (db) =>
        db.query(`insert into storage.objects (bucket_id, name) values ('statement-packages', $1)`, [
          name,
        ]),
      )
    await expect(upload(alice, path.replace('1.pdf', '9.pdf'))).rejects.toThrow()
    await expect(upload(bob, path)).rejects.toThrow()
    await upload(alice, path)
    const visibleTo = (user: string) =>
      database.asUser(user, (db) =>
        db.query('select name from storage.objects').then((r) => r.rows.length),
      )
    expect(await visibleTo(alice)).toBe(1)
    expect(await visibleTo(bob)).toBe(0)

    await database.asUser(alice, (db) => setStatus(db, id, 'extracting'))
    await database.db.query('delete from storage.objects')
    await expect(upload(alice, path)).rejects.toThrow()
  })
})

describe('Statement Package lifecycle', () => {
  it('moves uploaded → extracting → awaiting_confirmation → confirmed → checked', async () => {
    const id = await database.asUser(alice, extracted)
    expect(await database.asUser(alice, (db) => statusOf(db, id))).toBe('awaiting_confirmation')
    await database.asUser(alice, (db) => confirm(db, id))
    expect(await database.asUser(alice, (db) => statusOf(db, id))).toBe('checked')
  })

  it('allows a failed extraction to be retried', async () => {
    const id = await database.asUser(alice, (db) => createPackage(db))
    await database.asUser(alice, async (db) => {
      await setStatus(db, id, 'extracting')
      await setStatus(db, id, 'extraction_failed')
      await setStatus(db, id, 'extracting')
    })
    expect(await database.asUser(alice, (db) => statusOf(db, id))).toBe('extracting')
  })

  it('refuses to skip a step', async () => {
    const id = await database.asUser(alice, (db) => createPackage(db))
    await expect(
      database.asUser(alice, (db) => setStatus(db, id, 'awaiting_confirmation')),
    ).rejects.toThrow()
    await expect(database.asUser(alice, (db) => setStatus(db, id, 'checked'))).rejects.toThrow()
  })

  it('confirms only together with storing the Check Report', async () => {
    const id = await database.asUser(alice, extracted)
    await expect(
      database.asUser(alice, (db) =>
        setStatus(
          db,
          id,
          'confirmed',
          `, confirmed_figures = '${JSON.stringify(CONFIRMED)}', confirmed_at = now()`,
        ),
      ),
    ).rejects.toThrow()
    await expect(database.asUser(alice, (db) => setStatus(db, id, 'checked'))).rejects.toThrow()
    expect(await database.asUser(alice, (db) => statusOf(db, id))).toBe('awaiting_confirmation')
  })

  it('locks the Confirmed Figures once confirmed', async () => {
    const id = await database.asUser(alice, extracted)
    await database.asUser(alice, (db) => confirm(db, id))
    await expect(
      database.asUser(alice, (db) =>
        db.query(`update statement_packages set confirmed_figures = '{}' where id = $1`, [id]),
      ),
    ).rejects.toThrow()
    await expect(
      database.asUser(alice, (db) =>
        db.query(`update statement_packages set dispatch_date = '2027-01-01' where id = $1`, [id]),
      ),
    ).rejects.toThrow()
  })

  it('confirms a package only once', async () => {
    const id = await database.asUser(alice, extracted)
    await database.asUser(alice, (db) => confirm(db, id))
    await expect(database.asUser(alice, (db) => confirm(db, id))).rejects.toThrow()
  })
})

describe('Check Report', () => {
  const report = (user: string, id: string) =>
    database.asUser(user, (db) =>
      db
        .query<Record<string, unknown>>(
          `select ruleset_version, dispatch_date::text, confirmed_figures, building_profile, address, results
             from check_reports where id = $1`,
          [id],
        )
        .then((r) => r.rows[0]),
    )

  it('records the Confirmed Figures, Building Profile, address, Ruleset version and Dispatch Date', async () => {
    const reportId = await database.asUser(alice, async (db) => confirm(db, await extracted(db)))
    expect(await report(alice, reportId)).toEqual({
      ruleset_version: '0.1.0',
      dispatch_date: '2026-10-02',
      confirmed_figures: CONFIRMED,
      building_profile: PROFILE,
      address: ADDRESS,
      results: RESULTS,
    })
  })

  it('cannot be changed or deleted', async () => {
    const reportId = await database.asUser(alice, async (db) => confirm(db, await extracted(db)))
    await database
      .asUser(alice, (db) =>
        db.query(`update check_reports set results = '[]' where id = $1`, [reportId]),
      )
      .catch(() => {})
    await database
      .asUser(alice, (db) => db.query('delete from check_reports where id = $1', [reportId]))
      .catch(() => {})
    expect((await report(alice, reportId))?.results).toEqual(RESULTS)
  })

  it('keeps its Building Profile snapshot when the building is edited later', async () => {
    const reportId = await database.asUser(alice, async (db) => confirm(db, await extracted(db)))
    await database.asUser(alice, (db) =>
      db.query('update buildings set living_area_m2 = 999 where id = $1', [building]),
    )
    expect((await report(alice, reportId))?.building_profile).toEqual(PROFILE)
  })

  it("keeps the building's address as it was when checked", async () => {
    const reportId = await database.asUser(alice, async (db) => confirm(db, await extracted(db)))
    await database.asUser(alice, (db) =>
      db.query(`update buildings set street = 'Lindenstr. 5a' where id = $1`, [building]),
    )
    expect((await report(alice, reportId))?.address).toEqual(ADDRESS)
  })

  it('is stored only by confirming', async () => {
    const id = await database.asUser(alice, extracted)
    await expect(
      database.asUser(alice, (db) =>
        db.query(
          `insert into check_reports (statement_package_id, confirmed_figures, building_profile, ruleset_version, results)
           values ($1, $2, $3, '0.1.0', '[]')`,
          [id, JSON.stringify(CONFIRMED), JSON.stringify(PROFILE)],
        ),
      ),
    ).rejects.toThrow()
  })

  it('holds the Building Profile as stored, not one the caller makes up', async () => {
    const id = await database.asUser(alice, extracted)
    await expect(
      database.asUser(alice, (db) => confirm(db, id, { ...PROFILE, livingAreaM2: 2000 })),
    ).rejects.toThrow()
    expect(await database.asUser(alice, (db) => statusOf(db, id))).toBe('awaiting_confirmation')
  })

  it("is never visible to another Organisation, nor are its packages", async () => {
    const reportId = await database.asUser(alice, async (db) => confirm(db, await extracted(db)))
    expect(await report(bob, reportId)).toBeUndefined()
    expect(
      await database.asUser(bob, (db) =>
        db.query('select id from statement_packages').then((r) => r.rows),
      ),
    ).toEqual([])
  })
})

describe('Supersession', () => {
  const supersededBy = (id: string) =>
    database.asUser(alice, (db) =>
      db
        .query<{ superseded_by: string | null }>(
          'select superseded_by from statement_packages where id = $1',
          [id],
        )
        .then((r) => r.rows[0].superseded_by),
    )

  /** Uploads, extracts and confirms a package with the given Billing Period. */
  const checked = (period: object | null, buildingId = building) =>
    database.asUser(alice, async (db) => {
      const id = await extracted(db, buildingId)
      await confirm(db, id, PROFILE, confirmedFor(period))
      return id
    })

  it('supersedes the older package once a correction for the same Billing Period is confirmed', async () => {
    const original = await checked(PERIOD_2025)
    const correction = await checked(PERIOD_2025)
    expect(await supersededBy(original)).toBe(correction)
    expect(await supersededBy(correction)).toBeNull()
  })

  it('keeps the Superseded Package and its Check Report', async () => {
    const original = await checked(PERIOD_2025)
    await checked(PERIOD_2025)
    expect(await database.asUser(alice, (db) => statusOf(db, original))).toBe('checked')
    const reports = await database.asUser(alice, (db) =>
      db
        .query('select id from check_reports where statement_package_id = $1', [original])
        .then((r) => r.rows),
    )
    expect(reports).toHaveLength(1)
  })

  it('leaves the older package current until the correction is confirmed', async () => {
    const original = await checked(PERIOD_2025)
    await database.asUser(alice, (db) => extracted(db))
    expect(await supersededBy(original)).toBeNull()
  })

  it('does not supersede a package for another Billing Period or building', async () => {
    const other = await database.asUser(alice, (db) => createBuilding(db))
    const earlier = await checked(PERIOD_2024)
    const elsewhere = await checked(PERIOD_2025, other)
    await checked(PERIOD_2025)
    expect(await supersededBy(earlier)).toBeNull()
    expect(await supersededBy(elsewhere)).toBeNull()
  })

  it('does not supersede when the Billing Period is unknown', async () => {
    const first = await checked(null)
    await checked(null)
    expect(await supersededBy(first)).toBeNull()
  })

  it('keeps the history as a chain: each correction supersedes the one before', async () => {
    const first = await checked(PERIOD_2025)
    const second = await checked(PERIOD_2025)
    const third = await checked(PERIOD_2025)
    expect(await supersededBy(first)).toBe(second)
    expect(await supersededBy(second)).toBe(third)
    expect(await supersededBy(third)).toBeNull()
  })

  it('treats an older upload confirmed after its correction as superseded', async () => {
    const older = await database.asUser(alice, (db) => extracted(db))
    const correction = await checked(PERIOD_2025)
    await database.asUser(alice, (db) => confirm(db, older, PROFILE, confirmedFor(PERIOD_2025)))
    expect(await supersededBy(older)).toBe(correction)
    expect(await supersededBy(correction)).toBeNull()
  })

  it('cannot be set or undone directly', async () => {
    const original = await checked(PERIOD_2025)
    const correction = await checked(PERIOD_2025)
    const other = await checked(PERIOD_2024)
    await expect(
      database.asUser(alice, (db) =>
        db.query('update statement_packages set superseded_by = $2 where id = $1', [other, correction]),
      ),
    ).rejects.toThrow()
    await expect(
      database.asUser(alice, (db) =>
        db.query('update statement_packages set superseded_by = null where id = $1', [original]),
      ),
    ).rejects.toThrow()
    await expect(
      database.asUser(alice, (db) =>
        db.query(
          `insert into statement_packages (building_id, dispatch_date, superseded_by)
           values ($1, '2026-10-02', $2)`,
          [building, correction],
        ),
      ),
    ).rejects.toThrow()
  })
})
