import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { ACCOUNT_GROUPS, DEFAULT_GROUP_CODE, DIVISIONS, FUNDS } from "../lib/constants";
import type { PeopleConfig } from "./local-config";
import data from "./seed-data.json";
import * as schema from "./schema";

const {
  accountGroups, descriptions, divisions, funds, natures, officers, openingBalances, payors, signatories, users,
} = schema;

type SeedDb = NodePgDatabase<typeof schema>;

export interface SeedOptions {
  /** Collecting officers, report signatories and opening balances. Not in the code: see local-config.ts. */
  people: PeopleConfig;
  /** Suggestions for the payor field. */
  payors: string[];
  hashRounds?: number;
}

export async function seedAll(db: SeedDb, password: string, opts: SeedOptions) {
  const { people } = opts;
  await db.insert(funds).values(FUNDS.map((f) => ({ ...f }))).onConflictDoNothing();
  await db.insert(divisions).values(DIVISIONS.map((d) => ({ ...d }))).onConflictDoNothing();

  for (const [i, g] of ACCOUNT_GROUPS.entries()) {
    await db.insert(accountGroups).values({ code: g.code, name: g.name, sort: i + 1 }).onConflictDoNothing();
  }
  const groups = await db.select().from(accountGroups);
  const groupByCode = new Map(groups.map((g) => [g.code, g.id]));
  const natureToGroup = new Map<string, string>();
  for (const g of ACCOUNT_GROUPS) for (const n of g.natures) natureToGroup.set(n, g.code);

  const natureNames = new Set<string>([...data.nat, ...natureToGroup.keys()]);
  await db
    .insert(natures)
    .values(
      [...natureNames].sort().map((name) => ({
        name,
        groupId: groupByCode.get(natureToGroup.get(name) ?? DEFAULT_GROUP_CODE)!,
      })),
    )
    .onConflictDoNothing();

  for (let i = 0; i < data.desc.length; i += 200) {
    await db.insert(descriptions).values(data.desc.slice(i, i + 200).map((text) => ({ text }))).onConflictDoNothing();
  }
  for (let i = 0; i < opts.payors.length; i += 200) {
    await db.insert(payors).values(opts.payors.slice(i, i + 200).map((name) => ({ name }))).onConflictDoNothing();
  }

  await db
    .insert(officers)
    .values(people.officers.map((o) => ({ name: o.name, title: o.title, isCashier: !!o.cashier })))
    .onConflictDoNothing();
  const offs = await db.select().from(officers);
  const hash = await bcrypt.hash(password, opts.hashRounds ?? 12);
  for (const o of people.officers) {
    const officer = offs.find((x) => x.name === o.name)!;
    await db
      .insert(users)
      .values({ username: o.username, passwordHash: hash, displayName: o.name, role: "collector", officerId: officer.id })
      .onConflictDoNothing();
  }
  await db
    .insert(users)
    .values({ username: "admin", passwordHash: hash, displayName: "Administrator", role: "admin" })
    .onConflictDoNothing();

  // Collections carried over from the last report, if the config lists any.
  for (const ob of people.openingBalances) {
    const officer = offs.find((o) => o.name === ob.officer);
    const [fund] = await db.select().from(funds).where(eq(funds.code, ob.fund));
    if (!officer || !fund) throw new Error(`Opening balance refers to an unknown officer or fund: ${ob.officer} / ${ob.fund}`);
    await db.insert(openingBalances).values({ officerId: officer.id, fundId: fund.id, asOf: ob.asOf, amount: ob.amount }).onConflictDoNothing();
  }

  if (people.signatories.length) await db.insert(signatories).values(people.signatories.map((s) => ({ ...s }))).onConflictDoNothing();
}
