import { eq, sql } from "drizzle-orm";
import { db as defaultDb, schema, type Db } from "@/db";
import { AppError } from "@/lib/errors";
import { audit } from "./audit";
import { isPgError } from "./books";

const { divisions } = schema;

export interface AddDivisionInput {
  code: string;
  /** The code printed in the RCD's Div column. Leave blank for a division that has none. */
  rccCode?: string | null;
  /** The division controls its own order-of-payment numbers, so the receipt leaves that field blank (like MTSS). */
  noOpNumber?: boolean;
}

export async function addDivision(input: AddDivisionInput, userId: number | null, db: Db = defaultDb) {
  const code = input.code.trim().toUpperCase().replace(/\s+/g, " ");
  const rccCode = input.rccCode?.trim() || null;
  if (!/^[A-Z0-9][A-Z0-9 &/-]{1,15}$/.test(code)) {
    throw new AppError("Division names use 2 to 16 letters or numbers, for example MTSS or GD.");
  }
  if (rccCode && !/^\d{1,3}$/.test(rccCode)) throw new AppError("The RCD code is up to 3 digits, for example 03. Leave it blank if the division has none.");
  try {
    return await db.transaction(async (tx) => {
      const [{ max }] = await tx.select({ max: sql<number>`coalesce(max(${divisions.sort}), 0)` }).from(divisions);
      const [d] = await tx.insert(divisions).values({ code, rccCode, sort: max + 1, noOpNumber: !!input.noOpNumber }).returning();
      await audit(tx, userId, "division.add", "division", code, { rccCode, noOpNumber: d.noOpNumber });
      return d;
    });
  } catch (err) {
    if (isPgError(err, "23505")) throw new AppError(`There is already a division called ${code}. Pick it from the list.`, "duplicate");
    throw err;
  }
}

export async function getDivision(code: string, db: Db = defaultDb) {
  const [d] = await db.select().from(divisions).where(eq(divisions.code, code));
  return d ?? null;
}
