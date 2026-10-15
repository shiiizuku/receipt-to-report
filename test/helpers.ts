import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import pg from "pg";
import { sql } from "drizzle-orm";
import * as schema from "@/db/schema";
import { seedAll } from "@/db/seed-lib";
import type { PeopleConfig } from "@/db/local-config";

function testUrl(): string {
  if (process.env.TEST_DATABASE_URL) return process.env.TEST_DATABASE_URL;
  const file = resolve(process.cwd(), ".env");
  const env = existsSync(file) ? readFileSync(file, "utf8") : "";
  const m = /^DATABASE_URL=(.*)$/m.exec(env);
  if (!m) throw new Error("Set TEST_DATABASE_URL or DATABASE_URL in .env");
  return m[1].trim().replace(/\/[^/]+$/, "/r2r_test");
}

export const pool = new pg.Pool({ connectionString: testUrl(), max: 12 });
export const db = drizzle(pool, { schema });
export { schema };

/** Fictional people for the tests. The real names live in config/*.local.json, never in the code. */
export const TEST_PEOPLE: PeopleConfig = {
  officers: [
    { name: "JUAN A. CRUZ", title: "Cashier II", username: "officer1", cashier: true },
    { name: "MARIA B. SANTOS", title: null, username: "officer2" },
  ],
  signatories: [
    { key: "mrdc.prepared", report: "mrdc", label: "Prepared and Submitted by:", name: "CHIEF CASHIERING", title: "Chief, Cashiering Section", sort: 1 },
    { key: "mrdc.noted", report: "mrdc", label: "Noted by:", name: "NOTING OFFICER", title: "Title of noting officer", sort: 2 },
    { key: "sdc.prepared", report: "sdc", label: "Prepared by:", name: "Preparer Name", title: "Title", sort: 1 },
    { key: "sdc.reviewed", report: "sdc", label: "Reviewed by:", name: "Reviewer Name", title: "Title", sort: 2 },
    { key: "sdc.final", report: "sdc", label: "Final Reviewed by:", name: "Final Reviewer", title: "Title", sort: 3 },
    { key: "sdc.signed", report: "sdc", label: "Signed by:", name: "Signatory Name", title: "Title", sort: 4 },
  ],
  openingBalances: [],
};

let ready = false;
/** Migrate once, then reset all data and re-seed reference rows. */
export async function resetDb() {
  if (!ready) {
    await migrate(db, { migrationsFolder: "./drizzle" });
    ready = true;
  }
  // audit_events is append-only by trigger, so disable it only while truncating.
  await db.execute(sql`ALTER TABLE audit_events DISABLE TRIGGER audit_events_no_update`);
  await db.execute(sql`TRUNCATE receipt_lines, receipts, deposits, or_books, opening_balances, signatories, users, officers, descriptions, payors, natures, account_groups, divisions, funds, audit_events RESTART IDENTITY CASCADE`);
  await db.execute(sql`ALTER TABLE audit_events ENABLE TRIGGER audit_events_no_update`);
  await seedAll(db, "test-password", { hashRounds: 4, people: TEST_PEOPLE, payors: ["Test Payor Inc."] });
}

export async function ids() {
  const officers = await db.select().from(schema.officers);
  const funds = await db.select().from(schema.funds);
  const natures = await db.select().from(schema.natures);
  return {
    officer1: officers.find((o) => o.name === TEST_PEOPLE.officers[0].name)!.id,
    officer2: officers.find((o) => o.name === TEST_PEOPLE.officers[1].name)!.id,
    fund101: funds.find((f) => f.code === "101")!.id,
    fund151: funds.find((f) => f.code === "151")!.id,
    nature: (name: string) => natures.find((n) => n.name === name)!.id,
  };
}
