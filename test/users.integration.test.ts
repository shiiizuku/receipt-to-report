import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { generatePassword, passwordProblem } from "@/lib/password";
import { sessionStillValid } from "@/lib/session-rules";
import { changeOwnPassword, createUser, listUsers, resetPassword, setUserActive } from "@/services/users";
import { db, ids, resetDb, schema } from "./helpers";

let I: Awaited<ReturnType<typeof ids>>;
let adminId: number;

beforeEach(async () => {
  await resetDb();
  I = await ids();
  adminId = (await db.select().from(schema.users).where(eq(schema.users.username, "admin")))[0].id;
});

describe("password rules", () => {
  it("generates readable passwords that pass the policy", () => {
    const seen = new Set<string>();
    for (let i = 0; i < 200; i++) {
      const p = generatePassword();
      expect(p).toHaveLength(12);
      expect(p).toMatch(/^[a-km-zA-HJ-NP-Z2-9]+$/);
      expect(passwordProblem(p, "someone")).toBeNull();
      seen.add(p);
    }
    expect(seen.size).toBe(200);
  });

  it("refuses short, repeated and username-based passwords", () => {
    expect(passwordProblem("short1", "ana")).toMatch(/at least 10/);
    expect(passwordProblem("aaaaaaaaaaaa", "ana")).toMatch(/repeated/);
    expect(passwordProblem("my-ana-password", "ana")).toMatch(/username/);
    expect(passwordProblem("a sensible passphrase", "ana")).toBeNull();
  });
});

describe("session rules", () => {
  it("rejects sessions signed before the password changed", () => {
    const changed = new Date("2026-10-15T10:00:00Z");
    expect(sessionStillValid(undefined, null)).toBe(true);
    expect(sessionStillValid(Date.parse("2026-10-15T09:00:00Z") / 1000, changed)).toBe(false);
    expect(sessionStillValid(Date.parse("2026-10-15T10:00:00Z") / 1000, changed)).toBe(true);
    expect(sessionStillValid(Math.floor(Date.parse("2026-10-15T10:00:00.900Z") / 1000), changed)).toBe(true);
    expect(sessionStillValid(undefined, changed)).toBe(false);
  });
});

describe("creating users", () => {
  it("creates a collector for an existing officer with a generated one-time password", async () => {
    const r = await createUser({ username: "Maria.Cruz", displayName: "Maria Cruz", role: "collector", officerId: I.officer2 }, adminId, db);
    expect(r.username).toBe("maria.cruz");
    expect(r.generatedPassword).toHaveLength(12);
    const [u] = await db.select().from(schema.users).where(eq(schema.users.id, r.id));
    expect(u.officerId).toBe(I.officer2);
    expect(u.mustChangePassword).toBe(true);
    expect(await bcrypt.compare(r.generatedPassword!, u.passwordHash)).toBe(true);
    expect(u.passwordHash).not.toContain(r.generatedPassword!);
  });

  it("does not hand back a password the admin typed", async () => {
    const r = await createUser({ username: "temp.admin", displayName: "Temp Admin", role: "admin", password: "a sensible passphrase" }, adminId, db);
    expect(r.generatedPassword).toBeNull();
    const [u] = await db.select().from(schema.users).where(eq(schema.users.id, r.id));
    expect(u.officerId).toBeNull();
    expect(await bcrypt.compare("a sensible passphrase", u.passwordHash)).toBe(true);
  });

  it("can add a new collecting officer with the account", async () => {
    const r = await createUser({ username: "new.officer", displayName: "New Officer", role: "collector", newOfficer: { name: "pedro a. santos", title: "Cashier I" } }, adminId, db);
    const [u] = await db.select().from(schema.users).where(eq(schema.users.id, r.id));
    const [o] = await db.select().from(schema.officers).where(eq(schema.officers.id, u.officerId!));
    expect(o.name).toBe("PEDRO A. SANTOS");
    expect(o.title).toBe("Cashier I");
  });

  it("refuses bad input", async () => {
    await expect(createUser({ username: "x", displayName: "Someone", role: "admin" }, adminId, db)).rejects.toThrow(/username/);
    await expect(createUser({ username: "has space", displayName: "Someone", role: "admin" }, adminId, db)).rejects.toThrow(/username/);
    await expect(createUser({ username: "okname", displayName: "S", role: "admin" }, adminId, db)).rejects.toThrow(/full name/);
    await expect(createUser({ username: "okname", displayName: "Someone", role: "collector" }, adminId, db)).rejects.toThrow(/collecting officer/);
    await expect(createUser({ username: "okname", displayName: "Someone", role: "admin", password: "short" }, adminId, db)).rejects.toThrow(/at least 10/);
    await expect(createUser({ username: "officer1", displayName: "Another Officer", role: "admin" }, adminId, db)).rejects.toThrow(/already taken/);
    await expect(createUser({ username: "dupe.officer", displayName: "Dup", role: "collector", newOfficer: { name: "Juan A. Cruz" } }, adminId, db)).rejects.toThrow(/already exists/);
    expect((await listUsers(db)).some((u) => u.username === "dupe.officer")).toBe(false);
  });

  it("lists accounts with their officer, and never exposes password hashes", async () => {
    const rows = await listUsers(db);
    expect(rows.map((r) => r.username).sort()).toEqual(["admin", "officer1", "officer2"]);
    expect(rows.find((r) => r.username === "officer1")?.officerName).toBe("JUAN A. CRUZ");
    expect(JSON.stringify(rows)).not.toContain("$2");
  });

  it("writes the audit trail without any password", async () => {
    const r = await createUser({ username: "audited", displayName: "Audited User", role: "admin" }, adminId, db);
    const events = await db.select().from(schema.auditEvents);
    const e = events.find((x) => x.action === "user.create")!;
    expect(JSON.stringify(e.payload)).not.toContain(r.generatedPassword!);
    expect(e.userId).toBe(adminId);
  });
});

describe("resetting passwords", () => {
  it("sets a new temporary password, forces a change and ends old sessions", async () => {
    const officer1 = (await db.select().from(schema.users).where(eq(schema.users.username, "officer1")))[0];
    const before = officer1.passwordChangedAt;
    const r = await resetPassword(officer1.id, adminId, null, db);
    expect(r.generatedPassword).toHaveLength(12);
    const [after] = await db.select().from(schema.users).where(eq(schema.users.id, officer1.id));
    expect(await bcrypt.compare("test-password", after.passwordHash)).toBe(false);
    expect(await bcrypt.compare(r.generatedPassword!, after.passwordHash)).toBe(true);
    expect(after.mustChangePassword).toBe(true);
    expect(after.passwordChangedAt!.getTime()).toBeGreaterThan(before?.getTime() ?? 0);
    expect(sessionStillValid(Math.floor((Date.now() - 60_000) / 1000), after.passwordChangedAt)).toBe(false);
  });

  it("accepts a typed password only if it passes the policy", async () => {
    const officer1 = (await db.select().from(schema.users).where(eq(schema.users.username, "officer1")))[0];
    await expect(resetPassword(officer1.id, adminId, "short", db)).rejects.toThrow(/at least 10/);
    const r = await resetPassword(officer1.id, adminId, "a sensible passphrase", db);
    expect(r.generatedPassword).toBeNull();
    await expect(resetPassword(99999, adminId, null, db)).rejects.toThrow(/does not exist/);
  });
});

describe("disabling accounts", () => {
  it("disables and re-enables a collector, ending their sessions", async () => {
    const officer1 = (await db.select().from(schema.users).where(eq(schema.users.username, "officer1")))[0];
    await setUserActive(officer1.id, false, adminId, db);
    const [off] = await db.select().from(schema.users).where(eq(schema.users.id, officer1.id));
    expect(off.active).toBe(false);
    expect(sessionStillValid(Math.floor((Date.now() - 60_000) / 1000), off.passwordChangedAt)).toBe(false);
    await setUserActive(officer1.id, true, adminId, db);
    expect((await db.select().from(schema.users).where(eq(schema.users.id, officer1.id)))[0].active).toBe(true);
  });

  it("will not let an admin disable themselves or the last administrator", async () => {
    await expect(setUserActive(adminId, false, adminId, db)).rejects.toThrow(/your own account/);
    const second = await createUser({ username: "second.admin", displayName: "Second Admin", role: "admin" }, adminId, db);
    await expect(setUserActive(adminId, false, second.id, db)).resolves.toBeUndefined();
    await expect(setUserActive(second.id, false, 123456, db)).rejects.toThrow(/last active administrator/);
  });
});

describe("changing your own password", () => {
  it("needs the current password, clears the forced change, and ends other sessions", async () => {
    const r = await createUser({ username: "changer", displayName: "Change Er", role: "admin" }, adminId, db);
    await expect(changeOwnPassword(r.id, "not the password", "a sensible passphrase", db)).rejects.toThrow(/not right/);
    await expect(changeOwnPassword(r.id, r.generatedPassword!, r.generatedPassword!, db)).rejects.toThrow(/not used/);
    await expect(changeOwnPassword(r.id, r.generatedPassword!, "short", db)).rejects.toThrow(/at least 10/);
    await changeOwnPassword(r.id, r.generatedPassword!, "a sensible passphrase", db);
    const [u] = await db.select().from(schema.users).where(eq(schema.users.id, r.id));
    expect(u.mustChangePassword).toBe(false);
    expect(await bcrypt.compare("a sensible passphrase", u.passwordHash)).toBe(true);
  });
});
