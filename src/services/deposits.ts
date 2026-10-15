import { and, eq, inArray, isNull } from "drizzle-orm";
import { db as defaultDb, schema, type Db } from "@/db";
import { DEPOSITORY_BANK } from "@/lib/constants";
import { AppError } from "@/lib/errors";
import { toCents } from "@/lib/money";
import { audit } from "./audit";
import { isPgError } from "./books";

const { deposits, receipts } = schema;

export async function recordDeposit(
  input: { officerId: number; receiptIds: number[]; slipNo: string; date: string },
  userId: number | null,
  db: Db = defaultDb,
) {
  const slipNo = input.slipNo.trim();
  if (!slipNo) throw new AppError("Enter the deposit slip number.");
  if (!input.receiptIds.length) throw new AppError("Select at least one receipt for the deposit.");
  try {
    return await db.transaction(async (tx) => {
      const rows = await tx
        .select()
        .from(receipts)
        .where(inArray(receipts.id, input.receiptIds))
        .for("update");
      if (rows.length !== new Set(input.receiptIds).size) throw new AppError("One of the selected receipts no longer exists.");
      for (const r of rows) {
        if (r.officerId !== input.officerId) throw new AppError("A deposit can only hold one collecting officer's receipts.");
        if (r.status !== "posted") throw new AppError(`Receipt ${r.controlNo} is voided and cannot be deposited.`);
        if (r.depositId) throw new AppError(`Receipt ${r.controlNo} is already on a deposit slip.`);
      }
      const [dep] = await tx
        .insert(deposits)
        .values({ slipNo, depositDate: input.date, officerId: input.officerId, bank: DEPOSITORY_BANK, createdBy: userId })
        .returning();
      await tx.update(receipts).set({ depositId: dep.id }).where(inArray(receipts.id, input.receiptIds));
      const totalCents = rows.reduce((a, r) => a + toCents(r.total), 0);
      await audit(tx, userId, "deposit.record", "deposit", dep.id, { slipNo, receipts: rows.map((r) => r.controlNo), totalCents });
      return { id: dep.id, slipNo, totalCents };
    });
  } catch (err) {
    if (isPgError(err, "23505")) throw new AppError(`Slip ${slipNo} is already recorded.`, "duplicate");
    throw err;
  }
}

export async function validateDeposit(id: number, bankMsgNo: string, userId: number | null, db: Db = defaultDb) {
  const msg = bankMsgNo.trim();
  if (!msg) throw new AppError("Enter the bank message number to validate.");
  await db.transaction(async (tx) => {
    const [d] = await tx.select().from(deposits).where(eq(deposits.id, id)).for("update");
    if (!d) throw new AppError("That deposit does not exist.", "not-found");
    if (d.bankMsgNo) throw new AppError("That deposit is already validated.");
    await tx.update(deposits).set({ bankMsgNo: msg }).where(eq(deposits.id, id));
    await audit(tx, userId, "deposit.validate", "deposit", id, { slipNo: d.slipNo, bankMsgNo: msg });
  });
}

/** Undo a deposit that the bank has not validated yet; its receipts become undeposited again. */
export async function cancelDeposit(id: number, userId: number | null, db: Db = defaultDb) {
  await db.transaction(async (tx) => {
    const [d] = await tx.select().from(deposits).where(eq(deposits.id, id)).for("update");
    if (!d) throw new AppError("That deposit does not exist.", "not-found");
    if (d.bankMsgNo) throw new AppError("A validated deposit cannot be removed.");
    await tx.update(receipts).set({ depositId: null }).where(and(eq(receipts.depositId, id)));
    await tx.delete(deposits).where(and(eq(deposits.id, id), isNull(deposits.bankMsgNo)));
    await audit(tx, userId, "deposit.cancel", "deposit", id, { slipNo: d.slipNo });
  });
}

export async function nextSlipNo(db: Db = defaultDb): Promise<string> {
  const rows = await db.select({ slip: deposits.slipNo }).from(deposits);
  let max = 0;
  let year = new Date().getFullYear();
  for (const { slip } of rows) {
    const m = /^(\d{4})-(\d+)$/.exec(slip);
    if (m) {
      year = Math.max(year, Number(m[1]));
      max = Math.max(max, Number(m[2]));
    }
  }
  return `${year}-${max + 1}`;
}
