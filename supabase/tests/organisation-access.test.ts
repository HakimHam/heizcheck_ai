import { beforeEach, describe, expect, it } from "vitest";
import { createTestDatabase } from "./test-database";

type Db = Awaited<ReturnType<typeof createTestDatabase>>;

describe("Organisation access", () => {
  let db: Db;

  beforeEach(async () => {
    db = await createTestDatabase();
  });

  it("gives a new user their own Organisation", async () => {
    const userId = await db.signUp("anna@hv-mueller.de", { organisation_name: "HV Müller" });

    const organisations = await db.as<{ name: string }>(userId, "select name from organisations");

    expect(organisations).toEqual([{ name: "HV Müller" }]);
  });

  it("hides other Organisations and their members", async () => {
    const anna = await db.signUp("anna@hv-mueller.de", { organisation_name: "HV Müller" });
    const ben = await db.signUp("ben@hv-schmidt.de", { organisation_name: "HV Schmidt" });

    const organisations = await db.as<{ name: string }>(anna, "select name from organisations");
    const members = await db.as<{ user_id: string }>(anna, "select user_id from organisation_members");

    expect(organisations).toEqual([{ name: "HV Müller" }]);
    expect(members).toEqual([{ user_id: anna }]);
    expect(members).not.toContainEqual({ user_id: ben });
  });

  it("refuses a sign-up without an Organisation", async () => {
    await expect(db.signUp("ohne@example.de", {})).rejects.toThrow();
  });
});
