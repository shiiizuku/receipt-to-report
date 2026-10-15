import { and, asc, desc, eq, gte, ilike, inArray, lte, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db as defaultDb, schema, type Db, type Tx } from "@/db";
import { MODES } from "@/lib/constants";
import { AppError } from "@/lib/errors";
import { fromCents, toCents } from "@/lib/money";
import { audit } from "./audit";
import { advanceActiveBook, pgConstraint, recomputeNextNo } from "./books";

const { orBooks, receipts, receiptLines, natures, funds, officers, deposits, divisions } = schema;

/** The order-of-payment number to store: none when the division controls its own numbers. */
async function resolveOpNo(db: Db, division: string | null, opNo: string | null | undefined): Promise<string | null> {
  if (division) {
    const [d] = await db.select({ noOp: divisions.noOpNumber }).from(divisions).where(eq(divisions.code, division));
    if (!d) throw new AppError("That division does not exist.");
    if (d.noOp) return null;
  }
  return opNo || null;
}

const dateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid date.");

export const PostReceiptInput = z.object({
  date: dateStr,
  payor: z.string().trim().min(1, "Enter the payor.").max(200),
  officerId: z.number().int().positive(),
  /** Leave out to take the next number in the officer's active book. */
  controlNo: z.number().int().positive().optional(),
  fundId: z.number().int().positive(),
  division: z.string().trim().min(1).nullable().optional(),
  opNo: z.string().trim().max(40).nullable().optional(),
  modes: z.array(z.enum(MODES)).min(1, "Select how the payment was made."),
  instruments: z
    .array(z.object({ kind: z.enum(["Check", "Money Order"]), bank: z.string().trim().max(120), number: z.string().trim().max(60), date: z.string() }))
    .default([]),
  lines: z
    .array(
      z.object({
        natureId: z.number().int().positive(),
        amount: z.string(),
        descriptions: z.array(z.string().trim().min(1).max(200)).max(2).default([]),
      }),
    )
    .min(1, "Add a nature of collection and an amount.")
    .max(8, "A receipt has room for 8 lines."),
});
export type PostReceiptInput = z.input<typeof PostReceiptInput>;

export interface PostedReceipt {
  id: number;
  controlNo: number;
  totalCents: number;
  bookNo: number;
  bookExhausted: boolean;
  nextBookNo: number | null;
}

/** The officer's book that holds this number, locked for the rest of the transaction. */
async function bookHolding(tx: Tx, officerId: number, controlNo: number) {
  const [book] = await tx
    .select()
    .from(orBooks)
    .where(and(eq(orBooks.officerId, officerId), lte(orBooks.fromNo, controlNo), gte(orBooks.toNo, controlNo)))
    .for("update");
  if (!book) throw new AppError(`OR No. ${controlNo} is not in any of this officer's registered books. Register the book first.`, "no-book");
  return book;
}

async function assertNumberFree(tx: Tx, controlNo: number, exceptReceiptId?: number) {
  const [used] = await tx.select({ id: receipts.id }).from(receipts).where(eq(receipts.controlNo, controlNo));
  if (used && used.id !== exceptReceiptId) throw new AppError(`OR No. ${controlNo} is already used by another receipt.`, "number-used");
}

export async function postReceipt(raw: PostReceiptInput, userId: number | null, db: Db = defaultDb): Promise<PostedReceipt> {
  const parsed = PostReceiptInput.safeParse(raw);
  if (!parsed.success) throw new AppError(parsed.error.issues[0].message);
  const input = parsed.data;

  const lines = input.lines.map((l) => ({ ...l, cents: toCents(l.amount) }));
  if (lines.some((l) => l.cents <= 0)) throw new AppError("Every line needs an amount above zero.");
  const totalCents = lines.reduce((a, l) => a + l.cents, 0);

  const division = input.division ?? null;
  const opNo = await resolveOpNo(db, division, input.opNo);
  const instruments = input.modes.some((m) => m !== "Cash") ? input.instruments : [];

  try {
    return await db.transaction(async (tx) => {
      let book;
      let controlNo: number;
      if (input.controlNo) {
        controlNo = input.controlNo;
        book = await bookHolding(tx, input.officerId, controlNo);
        await assertNumberFree(tx, controlNo);
      } else {
        [book] = await tx
          .select()
          .from(orBooks)
          .where(and(eq(orBooks.officerId, input.officerId), eq(orBooks.isActive, true)))
          .for("update");
        if (!book) throw new AppError("This collecting officer has no active OR book. Set one active in OR books first.", "no-book");
        if (book.nextNo > book.toNo) throw new AppError("The active OR book is used up. Set another book active.", "no-book");
        controlNo = book.nextNo;
      }

      const [receipt] = await tx
        .insert(receipts)
        .values({
          controlNo,
          bookId: book.id,
          receiptDate: input.date,
          payor: input.payor,
          officerId: input.officerId,
          fundId: input.fundId,
          division,
          opNo,
          modes: input.modes,
          instruments: instruments.length ? instruments : null,
          total: fromCents(totalCents),
          createdBy: userId,
        })
        .returning();
      await tx.insert(receiptLines).values(
        lines.map((l, i) => ({
          receiptId: receipt.id,
          lineNo: i + 1,
          natureId: l.natureId,
          amount: fromCents(l.cents),
          descriptions: l.descriptions,
        })),
      );

      // The suggested next number moves past the highest number used. Skipped numbers stay visible in the book.
      const nextNo = Math.max(book.nextNo, controlNo + 1);
      await tx.update(orBooks).set({ nextNo }).where(eq(orBooks.id, book.id));
      let nextBookNo: number | null = null;
      const exhausted = nextNo > book.toNo;
      if (exhausted && book.isActive) {
        const next = await advanceActiveBook(tx, input.officerId, book.id);
        nextBookNo = next?.bookNo ?? null;
      }
      await audit(tx, userId, "receipt.post", "receipt", receipt.id, {
        controlNo,
        totalCents,
        payor: input.payor,
        chosenNumber: input.controlNo ? true : undefined,
      });
      return { id: receipt.id, controlNo, totalCents, bookNo: book.bookNo, bookExhausted: exhausted, nextBookNo };
    });
  } catch (err) {
    if (pgConstraint(err) === "receipts_control_no_unique") throw new AppError("That OR number was just used by another receipt. Try again.", "number-used");
    throw err;
  }
}

export const UpdateReceiptInput = PostReceiptInput.omit({ officerId: true }).extend({
  /** Only for a voided receipt: the reason it was voided. */
  voidReason: z.string().trim().min(5, "Give a reason of at least a few words.").max(300).optional(),
});
export type UpdateReceiptInput = z.input<typeof UpdateReceiptInput>;

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Correct a receipt, posted or voided: details, lines, payment and the OR control number. A voided
 * receipt stays out of every total, so correcting it moves no money; its void reason can be corrected too.
 * A receipt on a deposit slip keeps its amounts, payment mode, fund and date, because the deposit was
 * made for them; everything else can still be corrected. Every change is audited, before and after.
 */
export async function updateReceipt(id: number, raw: UpdateReceiptInput, userId: number | null, db: Db = defaultDb) {
  const parsed = UpdateReceiptInput.safeParse(raw);
  if (!parsed.success) throw new AppError(parsed.error.issues[0].message);
  const input = parsed.data;
  const lines = input.lines.map((l) => ({ ...l, cents: toCents(l.amount) }));
  if (lines.some((l) => l.cents <= 0)) throw new AppError("Every line needs an amount above zero.");
  const totalCents = lines.reduce((a, l) => a + l.cents, 0);
  const division = input.division ?? null;
  const opNo = await resolveOpNo(db, division, input.opNo);
  const instruments = input.modes.some((m) => m !== "Cash") ? input.instruments : [];

  try {
    return await db.transaction(async (tx) => {
      const [r] = await tx.select().from(receipts).where(eq(receipts.id, id)).for("update");
      if (!r) throw new AppError("That receipt does not exist.", "not-found");

      const oldLines = await tx
        .select({ natureId: receiptLines.natureId, nature: natures.name, amount: receiptLines.amount, descriptions: receiptLines.descriptions })
        .from(receiptLines)
        .innerJoin(natures, eq(natures.id, receiptLines.natureId))
        .where(eq(receiptLines.receiptId, id))
        .orderBy(asc(receiptLines.lineNo));

      if (r.depositId) {
        const [dep] = await tx.select({ slipNo: deposits.slipNo }).from(deposits).where(eq(deposits.id, r.depositId));
        const locked =
          input.fundId !== r.fundId ||
          input.date !== r.receiptDate ||
          !same([...input.modes].sort(), [...r.modes].sort()) ||
          lines.length !== oldLines.length ||
          lines.some((l, i) => l.cents !== toCents(oldLines[i].amount));
        if (locked) {
          throw new AppError(
            `This receipt is on deposit slip ${dep?.slipNo ?? ""}. Its amounts, payment mode, fund and date cannot change while it is deposited. You can still correct the payor, natures, descriptions, division, order of payment and the OR number, or remove the deposit first.`,
            "deposited",
          );
        }
      }

      // Control number: it must sit in one of this officer's books and not belong to another receipt.
      const newNo = input.controlNo ?? r.controlNo;
      let bookId = r.bookId;
      const touchedBooks = new Set<number>([r.bookId]);
      if (newNo !== r.controlNo) {
        const holder = await bookHolding(tx, r.officerId, newNo);
        await assertNumberFree(tx, newNo, id);
        bookId = holder.id;
        touchedBooks.add(holder.id);
      }
      // Lock every affected book in a fixed order so two edits cannot wait on each other.
      await tx.select({ id: orBooks.id }).from(orBooks).where(inArray(orBooks.id, [...touchedBooks])).orderBy(asc(orBooks.id)).for("update");

      const natureRows = await tx.select({ id: natures.id, name: natures.name }).from(natures).where(inArray(natures.id, lines.map((l) => l.natureId)));
      const natureNames = new Map(natureRows.map((n) => [n.id, n.name]));
      if (lines.some((l) => !natureNames.has(l.natureId))) throw new AppError("One of the natures of collection does not exist.");

      const before = {
        controlNo: r.controlNo, date: r.receiptDate, payor: r.payor, fundId: r.fundId, division: r.division, opNo: r.opNo,
        modes: r.modes, instruments: r.instruments ?? [], totalCents: toCents(r.total),
        lines: oldLines.map((l) => ({ nature: l.nature, cents: toCents(l.amount), descriptions: l.descriptions })),
      };
      const after = {
        controlNo: newNo, date: input.date, payor: input.payor, fundId: input.fundId, division, opNo,
        modes: input.modes, instruments, totalCents,
        lines: lines.map((l) => ({ nature: natureNames.get(l.natureId)!, cents: l.cents, descriptions: l.descriptions })),
      };
      const changes: Record<string, { from: unknown; to: unknown }> = {};
      for (const k of Object.keys(before) as Array<keyof typeof before>) if (!same(before[k], after[k])) changes[k] = { from: before[k], to: after[k] };
      const newReason = r.status === "voided" ? (input.voidReason ?? r.voidReason) : null;
      if (r.status === "voided" && newReason !== r.voidReason) changes.voidReason = { from: r.voidReason, to: newReason };
      if (Object.keys(changes).length === 0) return { id, controlNo: r.controlNo, changed: false };

      await tx
        .update(receipts)
        .set({
          controlNo: newNo,
          bookId,
          receiptDate: input.date,
          payor: input.payor,
          fundId: input.fundId,
          division,
          opNo,
          modes: input.modes,
          instruments: instruments.length ? instruments : null,
          total: fromCents(totalCents),
          ...(r.status === "voided" ? { voidReason: newReason } : {}),
        })
        .where(eq(receipts.id, id));
      await tx.delete(receiptLines).where(eq(receiptLines.receiptId, id));
      await tx.insert(receiptLines).values(
        lines.map((l, i) => ({ receiptId: id, lineNo: i + 1, natureId: l.natureId, amount: fromCents(l.cents), descriptions: l.descriptions })),
      );

      if (newNo !== r.controlNo) {
        for (const bid of touchedBooks) {
          const book = await recomputeNextNo(tx, bid);
          if (book.isActive && book.nextNo > book.toNo) await advanceActiveBook(tx, r.officerId, book.id);
        }
      }
      await audit(tx, userId, "receipt.edit", "receipt", id, { controlNo: newNo, changes, voided: r.status === "voided" ? true : undefined });
      return { id, controlNo: newNo, changed: true };
    });
  } catch (err) {
    if (pgConstraint(err) === "receipts_control_no_unique") throw new AppError("That OR number was just used by another receipt. Try again.", "number-used");
    throw err;
  }
}

export async function voidReceipt(id: number, reason: string, userId: number | null, db: Db = defaultDb) {
  const why = reason.trim();
  if (why.length < 5) throw new AppError("Give a reason of at least a few words. It is kept in the audit trail.");
  await db.transaction(async (tx) => {
    const [r] = await tx.select().from(receipts).where(eq(receipts.id, id)).for("update");
    if (!r) throw new AppError("That receipt does not exist.", "not-found");
    if (r.status === "voided") throw new AppError("That receipt is already voided.");
    if (r.depositId) throw new AppError("This receipt is on a deposit slip. Take it off the deposit before voiding it.", "deposited");
    await tx.update(receipts).set({ status: "voided", voidReason: why, voidedAt: new Date(), voidedBy: userId }).where(eq(receipts.id, id));
    await audit(tx, userId, "receipt.void", "receipt", id, { controlNo: r.controlNo, reason: why, totalCents: toCents(r.total) });
  });
}

export interface ReceiptFilters {
  from?: string;
  to?: string;
  officerId?: number;
  fundId?: number;
  status?: "posted" | "voided";
  q?: string;
  deposited?: "yes" | "no";
  page?: number;
  pageSize?: number;
}

/** Payor text match, plus an OR-number match when the search contains digits. */
function searchCondition(q: string | undefined) {
  const text = q?.trim();
  if (!text) return undefined;
  const escaped = text.replace(/[\\%_]/g, (c) => `\\${c}`);
  const digits = text.replace(/\D/g, "");
  const byPayor = ilike(receipts.payor, `%${escaped}%`);
  return digits ? or(byPayor, sql`${receipts.controlNo}::text LIKE ${`%${digits}%`}`) : byPayor;
}

export interface ReceiptListRow {
  id: number;
  controlNo: number;
  date: string;
  payor: string;
  officerName: string;
  fundName: string;
  modes: string[];
  totalCents: number;
  status: "posted" | "voided";
  depositSlip: string | null;
  firstNature: string;
  lineCount: number;
}

export async function listReceipts(f: ReceiptFilters, db: Db = defaultDb): Promise<{ rows: ReceiptListRow[]; total: number; page: number; pageSize: number }> {
  const page = Math.max(1, f.page ?? 1);
  const pageSize = f.pageSize ?? 25;
  const conds = [
    f.from ? gte(receipts.receiptDate, f.from) : undefined,
    f.to ? lte(receipts.receiptDate, f.to) : undefined,
    f.officerId ? eq(receipts.officerId, f.officerId) : undefined,
    f.fundId ? eq(receipts.fundId, f.fundId) : undefined,
    f.status ? eq(receipts.status, f.status) : undefined,
    f.deposited === "yes" ? sql`${receipts.depositId} IS NOT NULL` : f.deposited === "no" ? sql`${receipts.depositId} IS NULL` : undefined,
    searchCondition(f.q),
  ].filter(Boolean);
  const where = conds.length ? and(...conds) : undefined;

  const [{ count }] = await db.select({ count: sql<number>`count(*)::int` }).from(receipts).where(where);
  const rows = await db
    .select({
      id: receipts.id,
      controlNo: receipts.controlNo,
      date: receipts.receiptDate,
      payor: receipts.payor,
      officerName: officers.name,
      fundName: funds.name,
      modes: receipts.modes,
      total: receipts.total,
      status: receipts.status,
      depositSlip: deposits.slipNo,
      firstNature: sql<string>`(select n.name from receipt_lines l join natures n on n.id = l.nature_id where l.receipt_id = ${receipts.id} order by l.line_no limit 1)`,
      lineCount: sql<number>`(select count(*)::int from receipt_lines l where l.receipt_id = ${receipts.id})`,
    })
    .from(receipts)
    .innerJoin(officers, eq(officers.id, receipts.officerId))
    .innerJoin(funds, eq(funds.id, receipts.fundId))
    .leftJoin(deposits, eq(deposits.id, receipts.depositId))
    .where(where)
    .orderBy(desc(receipts.receiptDate), desc(receipts.controlNo))
    .limit(pageSize)
    .offset((page - 1) * pageSize);

  return {
    total: count,
    page,
    pageSize,
    rows: rows.map((r) => ({
      id: r.id,
      controlNo: r.controlNo,
      date: r.date,
      payor: r.payor,
      officerName: r.officerName,
      fundName: r.fundName,
      modes: r.modes,
      totalCents: toCents(r.total),
      status: r.status as "posted" | "voided",
      depositSlip: r.depositSlip,
      firstNature: r.firstNature,
      lineCount: r.lineCount,
    })),
  };
}

export async function getReceipt(id: number, db: Db = defaultDb) {
  const [r] = await db
    .select({ r: receipts, officerName: officers.name, officerTitle: officers.title, fundName: funds.name, depositSlip: deposits.slipNo })
    .from(receipts)
    .innerJoin(officers, eq(officers.id, receipts.officerId))
    .innerJoin(funds, eq(funds.id, receipts.fundId))
    .leftJoin(deposits, eq(deposits.id, receipts.depositId))
    .where(eq(receipts.id, id));
  if (!r) return null;
  const lines = await db
    .select({ lineNo: receiptLines.lineNo, natureId: receiptLines.natureId, nature: natures.name, amount: receiptLines.amount, descriptions: receiptLines.descriptions })
    .from(receiptLines)
    .innerJoin(natures, eq(natures.id, receiptLines.natureId))
    .where(eq(receiptLines.receiptId, id))
    .orderBy(receiptLines.lineNo);
  return { ...r, lines: lines.map((l) => ({ ...l, cents: toCents(l.amount) })) };
}
