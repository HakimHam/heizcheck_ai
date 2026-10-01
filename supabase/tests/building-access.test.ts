import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createTestDatabase, type TestDatabase } from './test-database'

let database: TestDatabase
let alice: string
let bob: string
let carol: string

beforeEach(async () => {
  database = await createTestDatabase()
  alice = await database.signUp('alice@hv-mueller.de', 'Hausverwaltung Müller')
  bob = await database.signUp('bob@hv-schmidt.de', 'Hausverwaltung Schmidt')
  carol = await database.signUp('carol@hv-mueller.de', 'ignored')
  await database.db.query(
    `update organisation_members
        set organisation_id = (select organisation_id from organisation_members where user_id = $1)
      where user_id = $2`,
    [alice, carol],
  )
})

afterEach(() => database.db.close())

type Db = TestDatabase['db']

const createBuilding = (db: Db, street: string, residential = true) =>
  db
    .query<{ id: string }>(
      `insert into buildings (street, postal_code, city, residential)
       values ($1, '10115', 'Berlin', $2) returning id`,
      [street, residential],
    )
    .then((r) => r.rows[0].id)

const streets = (db: Db) =>
  db
    .query<{ street: string }>('select street from buildings order by street')
    .then((r) => r.rows.map((row) => row.street))

describe('Building access', () => {
  it('lets a Property Manager create a building and see it in the list', async () => {
    await database.asUser(alice, (db) => createBuilding(db, 'Lindenstraße 5'))
    expect(await database.asUser(alice, streets)).toEqual(['Lindenstraße 5'])
  })

  it('shows every member of the owning Organisation its buildings', async () => {
    await database.asUser(alice, (db) => createBuilding(db, 'Lindenstraße 5'))
    expect(await database.asUser(carol, streets)).toEqual(['Lindenstraße 5'])
  })

  it("never shows a user another Organisation's buildings", async () => {
    await database.asUser(alice, (db) => createBuilding(db, 'Lindenstraße 5'))
    await database.asUser(bob, (db) => createBuilding(db, 'Bahnhofstraße 1'))
    expect(await database.asUser(alice, streets)).toEqual(['Lindenstraße 5'])
    expect(await database.asUser(bob, streets)).toEqual(['Bahnhofstraße 1'])
  })

  it('shows no buildings to a visitor who is not signed in', async () => {
    await database.asUser(alice, (db) => createBuilding(db, 'Lindenstraße 5'))
    await database.db.exec('set role anon')
    try {
      expect(await streets(database.db)).toEqual([])
    } finally {
      await database.db.exec('reset role')
    }
  })

  it('does not let a user create a building for another Organisation', async () => {
    const bobsOrganisation = await database.asUser(bob, (db) =>
      db.query<{ id: string }>('select id from organisations').then((r) => r.rows[0].id),
    )
    await expect(
      database.asUser(alice, (db) =>
        db.query(
          `insert into buildings (organisation_id, street, postal_code, city, residential)
           values ($1, 'Fremdweg 1', '10115', 'Berlin', true)`,
          [bobsOrganisation],
        ),
      ),
    ).rejects.toThrow()
    expect(await database.asUser(bob, streets)).toEqual([])
  })

  it("does not let a user edit another Organisation's building", async () => {
    const bobsBuilding = await database.asUser(bob, (db) => createBuilding(db, 'Bahnhofstraße 1'))
    await database.asUser(alice, (db) =>
      db.query(`update buildings set street = 'gekapert' where id = $1`, [bobsBuilding]),
    )
    expect(await database.asUser(bob, streets)).toEqual(['Bahnhofstraße 1'])
  })

  it('does not let a user move a building into another Organisation', async () => {
    const bobsOrganisation = await database.asUser(bob, (db) =>
      db.query<{ id: string }>('select id from organisations').then((r) => r.rows[0].id),
    )
    const building = await database.asUser(alice, (db) => createBuilding(db, 'Lindenstraße 5'))
    await database
      .asUser(alice, (db) =>
        db.query('update buildings set organisation_id = $1 where id = $2', [
          bobsOrganisation,
          building,
        ]),
      )
      .catch(() => {})
    expect(await database.asUser(alice, streets)).toEqual(['Lindenstraße 5'])
    expect(await database.asUser(bob, streets)).toEqual([])
  })
})

describe('Building Profile', () => {
  const profileOf = (id: string) =>
    database.asUser(alice, (db) =>
      db
        .query(
          `select living_area_m2, heated_area_m2, mandatory_70_pct, residential, co2_reduction
             from buildings where id = $1`,
          [id],
        )
        .then((r) => r.rows[0]),
    )

  it('stores unset facts as unknown rather than a default', async () => {
    const id = await database.asUser(alice, (db) => createBuilding(db, 'Lindenstraße 5'))
    expect(await profileOf(id)).toEqual({
      living_area_m2: null,
      heated_area_m2: null,
      mandatory_70_pct: null,
      residential: true,
      co2_reduction: null,
    })
  })

  it('keeps an edited profile', async () => {
    const id = await database.asUser(alice, (db) => createBuilding(db, 'Lindenstraße 5'))
    await database.asUser(carol, (db) =>
      db.query(
        `update buildings
            set living_area_m2 = 812.45, heated_area_m2 = 790.5, mandatory_70_pct = false,
                residential = false, co2_reduction = 'heritage'
          where id = $1`,
        [id],
      ),
    )
    expect(await profileOf(id)).toEqual({
      living_area_m2: '812.45',
      heated_area_m2: '790.50',
      mandatory_70_pct: false,
      residential: false,
      co2_reduction: 'heritage',
    })
  })

  it('rejects a CO₂ reduction the Ruleset does not know', async () => {
    const id = await database.asUser(alice, (db) => createBuilding(db, 'Lindenstraße 5'))
    await expect(
      database.asUser(alice, (db) =>
        db.query(`update buildings set co2_reduction = 'solar' where id = $1`, [id]),
      ),
    ).rejects.toThrow()
  })

  it('rejects areas that are not positive', async () => {
    const id = await database.asUser(alice, (db) => createBuilding(db, 'Lindenstraße 5'))
    await expect(
      database.asUser(alice, (db) =>
        db.query('update buildings set living_area_m2 = 0 where id = $1', [id]),
      ),
    ).rejects.toThrow()
  })
})
