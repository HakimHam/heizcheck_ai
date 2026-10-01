import { beforeEach, describe, expect, it } from 'vitest'
import { createTestDatabase, type TestDatabase } from './test-database'

let database: TestDatabase
let alice: string
let bob: string
let carol: string

beforeEach(async () => {
  database = await createTestDatabase()
  alice = await database.signUp('alice@hv-mueller.de', 'Hausverwaltung Müller')
  bob = await database.signUp('bob@hv-schmidt.de', 'Hausverwaltung Schmidt')
  // Carol joins Alice's Organisation (invitations arrive in a later ticket).
  carol = await database.signUp('carol@hv-mueller.de', 'ignored')
  await database.db.query(
    `update organisation_members
        set organisation_id = (select organisation_id from organisation_members where user_id = $1)
      where user_id = $2`,
    [alice, carol],
  )
})

const organisationNames = (db: TestDatabase['db']) =>
  db.query<{ name: string }>('select name from organisations order by name').then((r) =>
    r.rows.map((row) => row.name),
  )

const colleagues = (db: TestDatabase['db']) =>
  db.query<{ user_id: string }>('select user_id from organisation_members order by user_id').then(
    (r) => r.rows.map((row) => row.user_id),
  )

const organisationIdOf = (user: string) =>
  database.asUser(user, (db) =>
    db.query<{ id: string }>('select id from organisations').then((r) => r.rows[0].id),
  )

describe('Organisation access', () => {
  it('gives every new user an Organisation of their own', async () => {
    expect(await database.asUser(bob, organisationNames)).toEqual(['Hausverwaltung Schmidt'])
  })

  it("never shows a user another Organisation's rows", async () => {
    expect(await database.asUser(alice, organisationNames)).toEqual(['Hausverwaltung Müller'])
    expect(await database.asUser(alice, colleagues)).toEqual([alice, carol].sort())
  })

  it('shows nothing to a visitor who is not signed in', async () => {
    await database.db.exec('set role anon')
    try {
      expect(await organisationNames(database.db)).toEqual([])
    } finally {
      await database.db.exec('reset role')
    }
  })

  it('shows every member of an Organisation the same rows', async () => {
    expect(await database.asUser(carol, organisationNames)).toEqual(
      await database.asUser(alice, organisationNames),
    )
    expect(await database.asUser(carol, colleagues)).toEqual(
      await database.asUser(alice, colleagues),
    )
  })

  it("does not let a user change another Organisation's rows", async () => {
    const bobsOrganisation = await organisationIdOf(bob)
    await database
      .asUser(alice, (db) =>
        db.query(`update organisations set name = 'gekapert' where id = $1`, [bobsOrganisation]),
      )
      .catch(() => {})
    expect(await database.asUser(bob, organisationNames)).toEqual(['Hausverwaltung Schmidt'])
  })

  it('does not let a user join another Organisation on their own', async () => {
    const bobsOrganisation = await organisationIdOf(bob)
    await database
      .asUser(alice, (db) =>
        db.query('update organisation_members set organisation_id = $1 where user_id = $2', [
          bobsOrganisation,
          alice,
        ]),
      )
      .catch(() => {})
    expect(await database.asUser(alice, organisationNames)).toEqual(['Hausverwaltung Müller'])
    expect(await database.asUser(bob, colleagues)).toEqual([bob])
  })

  it('lets a user belong to exactly one Organisation', async () => {
    const bobsOrganisation = await organisationIdOf(bob)
    await expect(
      database.db.query(
        'insert into organisation_members (organisation_id, user_id) values ($1, $2)',
        [bobsOrganisation, alice],
      ),
    ).rejects.toThrow()
  })

  it('has row-level security on every table in the public schema', async () => {
    const unprotected = await database.db.query<{ relname: string }>(
      `select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity`,
    )
    expect(unprotected.rows).toEqual([])
  })
})
