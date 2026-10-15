import { and, asc, eq, ne, sql } from "drizzle-orm";
import { db as defaultDb, schema, type Db, type Tx } from "@/db";
import { AppError } from "@/lib/errors";
import { audit } from "./audit";

const { orBooks, officers } = schema;

export interface BookRow {
  id: number;
  bookNo: number;
  fromNo: number;
  toNo: number;
  nextNo: number;
  officerId: number;
  officerName: string;
  receivedOn: string;
  isActive: boolean;
  issued: number;
  left: number;
  /** Numbers below the next one that no receipt uses: skipped, or moved to another number. */
  gaps: number[];
  status: "active" | "in-stock" | "on-hold" | "exhausted";
}

/** Numbers from `from` to `upTo` that are not in `used`. */
export function gapsIn(from: number, upTo: number, used: Set<number> | undefined): number[] {
  const out: number[] = [];
  for (let n = from; n <= upTo; n++) if (!used?.has(n)) out.push(n);
  return out;
}

export function bookStatus(b: { fromNo: number; toNo: number; nextNo: number; isActive: boolean }): BookRow["status"] {
  if (b.nextNo > b.toNo) return "exhausted";
  if (b.isActive) return "active";
  return b.nextNo === b.fromNo ? "in-stock" : "on-hold";
}

export async function listBooks(db: Db = defaultDb): Promise<BookRow[]> {
  const rows = await db
    .select({ b: orBooks, officerName: officers.name })
    .from(orBooks)
    .innerJoin(officers, eq(officers.id, orBooks.officerId))
    .orderBy(asc(orBooks.fromNo));
  const used = await db.select({ bookId: schema.receipts.bookId, controlNo: schema.receipts.controlNo }).from(schema.receipts);
  const usedBy = new Map<number, Set<number>>();
  for (const u of used) {
    if (!usedBy.has(u.bookId)) usedBy.set(u.bookId, new Set());
    usedBy.get(u.bookId)!.add(u.controlNo);
  }
  return rows.map(({ b, officerName }) => ({
    gaps: gapsIn(b.fromNo, Math.min(b.nextNo - 1, b.toNo), usedBy.get(b.id)),
    id: b.id,
    bookNo: b.bookNo,
    fromNo: b.fromNo,
    toNo: b.toNo,
    nextNo: b.nextNo,
    officerId: b.officerId,
    officerName,
    receivedOn: b.receivedOn,
    isActive: b.isActive,
    issued: b.nextNo - b.fromNo,
    left: Math.max(0, b.toNo - b.nextNo + 1),
    status: bookStatus(b),
  }));
}

export async function registerBook(
  input: { fromNo: number; toNo: number; officerId: number; receivedOn: string },
  userId: number | null,
  db: Db = defaultDb,
) {
  if (!Number.isInteger(input.fromNo) || !Number.isInteger(input.toNo) || input.fromNo <= 0) {
    throw new AppError("Enter whole numbers for the first and last control number.");
  }
  if (input.toNo < input.fromNo) throw new AppError("The last number must come after the first.");
  try {
    return await db.transaction(async (tx) => {
      const [{ max }] = await tx.select({ max: sql<number>`coalesce(max(${orBooks.bookNo}), 0)` }).from(orBooks);
      const [hasActive] = await tx
        .select({ id: orBooks.id })
        .from(orBooks)
        .where(and(eq(orBooks.officerId, input.officerId), eq(orBooks.isActive, true)));
      const [book] = await tx
        .insert(orBooks)
        .values({
          bookNo: max + 1,
          fromNo: input.fromNo,
          toNo: input.toNo,
          nextNo: input.fromNo,
          officerId: input.officerId,
          receivedOn: input.receivedOn,
          isActive: !hasActive,
        })
        .returning();
      await audit(tx, userId, "book.register", "or_book", book.id, { ...input, bookNo: book.bookNo });
      return book;
    });
  } catch (err) {
    if (isPgError(err, "23P01")) {
      throw new AppError("These control numbers overlap an existing book. Control numbers cannot be reused.", "overlap");
    }
    throw err;
  }
}

export async function setActiveBook(bookId: number, userId: number | null, db: Db = defaultDb) {
  await db.transaction(async (tx) => {
    const [book] = await tx.select().from(orBooks).where(eq(orBooks.id, bookId)).for("update");
    if (!book) throw new AppError("That book does not exist.", "not-found");
    if (book.nextNo > book.toNo) throw new AppError("That book is used up.");
    await tx
      .update(orBooks)
      .set({ isActive: false })
      .where(and(eq(orBooks.officerId, book.officerId), ne(orBooks.id, book.id)));
    await tx.update(orBooks).set({ isActive: true }).where(eq(orBooks.id, book.id));
    await audit(tx, userId, "book.activate", "or_book", book.id, { officerId: book.officerId });
  });
}

/** When a book runs out, hand the officer's next unopened book the active flag. */
export async function advanceActiveBook(tx: Tx, officerId: number, exhaustedId: number) {
  await tx.update(orBooks).set({ isActive: false }).where(eq(orBooks.id, exhaustedId));
  const [next] = await tx
    .select()
    .from(orBooks)
    .where(
      and(
        eq(orBooks.officerId, officerId),
        ne(orBooks.id, exhaustedId),
        sql`${orBooks.nextNo} = ${orBooks.fromNo}`,
        sql`${orBooks.nextNo} <= ${orBooks.toNo}`,
      ),
    )
    .orderBy(asc(orBooks.fromNo))
    .limit(1);
  if (next) await tx.update(orBooks).set({ isActive: true }).where(eq(orBooks.id, next.id));
  return next ?? null;
}

export function isPgError(err: unknown, code: string): boolean {
  let e: unknown = err;
  while (e && typeof e === "object") {
    if ((e as { code?: string }).code === code) return true;
    e = (e as { cause?: unknown }).cause;
  }
  return false;
}

export async function voidedByBook(db: Db = defaultDb): Promise<Map<number, number[]>> {
  const rows = await db
    .select({ bookId: schema.receipts.bookId, controlNo: schema.receipts.controlNo })
    .from(schema.receipts)
    .where(eq(schema.receipts.status, "voided"))
    .orderBy(asc(schema.receipts.controlNo));
  const out = new Map<number, number[]>();
  for (const r of rows) out.set(r.bookId, [...(out.get(r.bookId) ?? []), r.controlNo]);
  return out;
}

/** The name of the constraint a Postgres error refers to, looking through wrapped errors. */
export function pgConstraint(err: unknown): string {
  let e: unknown = err;
  while (e && typeof e === "object") {
    const c = (e as { constraint?: string }).constraint;
    if (c) return c;
    e = (e as { cause?: unknown }).cause;
  }
  return "";
}


/** The suggested next number is one past the highest number used in the book, or the first number if none is. */
export async function recomputeNextNo(tx: Tx, bookId: number) {
  const [{ max }] = await tx
    .select({ max: sql<number | null>`max(${schema.receipts.controlNo})` })
    .from(schema.receipts)
    .where(eq(schema.receipts.bookId, bookId));
  const [book] = await tx.select().from(orBooks).where(eq(orBooks.id, bookId));
  const nextNo = Math.min(book.toNo + 1, Math.max(book.fromNo, max === null ? book.fromNo : Number(max) + 1));
  const [updated] = await tx.update(orBooks).set({ nextNo }).where(eq(orBooks.id, bookId)).returning();
  return updated;
}
