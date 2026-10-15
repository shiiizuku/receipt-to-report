import { asc, eq, lte } from "drizzle-orm";
import { db as defaultDb, schema, type Db } from "@/db";
import { toCents } from "@/lib/money";
import type { RDeposit, ROpening, RReceipt } from "./reports/compute";

const { receipts, receiptLines, natures, accountGroups, deposits, openingBalances, signatories } = schema;

export interface ReportData {
  receipts: RReceipt[];
  deposits: RDeposit[];
  openings: ROpening[];
}

/** Everything the report calculations need up to and including `to`. */
export async function loadReportData(to: string, db: Db = defaultDb): Promise<ReportData> {
  const rs = await db.select().from(receipts).where(lte(receipts.receiptDate, to));
  const lines = await db
    .select({
      receiptId: receiptLines.receiptId,
      nature: natures.name,
      sort: accountGroups.sort,
      amount: receiptLines.amount,
      descriptions: receiptLines.descriptions,
      lineNo: receiptLines.lineNo,
    })
    .from(receiptLines)
    .innerJoin(natures, eq(natures.id, receiptLines.natureId))
    .innerJoin(accountGroups, eq(accountGroups.id, natures.groupId))
    .orderBy(asc(receiptLines.receiptId), asc(receiptLines.lineNo));
  const byReceipt = new Map<number, RReceipt["lines"]>();
  for (const l of lines) {
    const list = byReceipt.get(l.receiptId) ?? [];
    list.push({ nature: l.nature, group: l.sort - 1, cents: toCents(l.amount), descriptions: l.descriptions });
    byReceipt.set(l.receiptId, list);
  }
  const deps = await db.select().from(deposits);
  const opens = await db.select().from(openingBalances);
  return {
    receipts: rs.map((r) => ({
      controlNo: r.controlNo,
      date: r.receiptDate,
      payor: r.payor,
      officerId: r.officerId,
      fundId: r.fundId,
      division: r.division,
      opNo: r.opNo,
      modes: r.modes,
      depositId: r.depositId,
      status: r.status as "posted" | "voided",
      lines: byReceipt.get(r.id) ?? [],
      totalCents: toCents(r.total),
    })),
    deposits: deps.map((d) => ({ id: d.id, slipNo: d.slipNo, date: d.depositDate, officerId: d.officerId, bankMsgNo: d.bankMsgNo })),
    openings: opens.map((o) => ({ officerId: o.officerId, fundId: o.fundId, cents: toCents(o.amount) })),
  };
}

export async function loadSignatories(report: "mrdc" | "sdc", db: Db = defaultDb) {
  return db.select().from(signatories).where(eq(signatories.report, report)).orderBy(asc(signatories.sort));
}
