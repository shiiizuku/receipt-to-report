import { beforeEach, describe, expect, it } from "vitest";
import { registerBook } from "@/services/books";
import { recordDeposit } from "@/services/deposits";
import { getReceipt, listReceipts, postReceipt, voidReceipt } from "@/services/receipts";
import { db, ids, resetDb } from "./helpers";

let I: Awaited<ReturnType<typeof ids>>;

async function post(over: { date?: string; payor?: string; officerId?: number; fundId?: number; amount?: string; nature?: string } = {}) {
  return postReceipt(
    {
      date: over.date ?? "2026-10-16",
      payor: over.payor ?? "Santos Mining Corp.",
      officerId: over.officerId ?? I.officer1,
      fundId: over.fundId ?? I.fund101,
      division: "MTES",
      modes: ["Cash"],
      lines: [{ natureId: I.nature(over.nature ?? "APPLICATION FEE"), amount: over.amount ?? "2000", descriptions: [] }],
    },
    null,
    db,
  );
}

beforeEach(async () => {
  await resetDb();
  I = await ids();
  await registerBook({ fromNo: 1, toNo: 99, officerId: I.officer1, receivedOn: "2026-10-01" }, null, db);
  await registerBook({ fromNo: 200, toNo: 299, officerId: I.officer2, receivedOn: "2026-10-01" }, null, db);
});

describe("receipts list", () => {
  it("shows posted and voided receipts, newest control number first", async () => {
    const a = await post({ payor: "First Payor" });
    await post({ payor: "Second Payor" });
    await voidReceipt(a.id, "Wrong payor written", null, db);
    const all = await listReceipts({}, db);
    expect(all.total).toBe(2);
    expect(all.rows.map((r) => [r.controlNo, r.status])).toEqual([[2, "posted"], [1, "voided"]]);
  });

  it("filters by status, officer, fund, date, deposit and search text", async () => {
    const a = await post({ date: "2026-10-01", payor: "Alpha Mining" });
    await post({ date: "2026-10-10", payor: "Beta Quarry", fundId: I.fund151 });
    await post({ date: "2026-10-20", payor: "Gamma Sand", officerId: I.officer2 });
    await voidReceipt(a.id, "Entered twice by mistake", null, db);

    expect((await listReceipts({ status: "voided" }, db)).rows.map((r) => r.payor)).toEqual(["Alpha Mining"]);
    expect((await listReceipts({ status: "posted" }, db)).total).toBe(2);
    expect((await listReceipts({ officerId: I.officer2 }, db)).rows.map((r) => r.payor)).toEqual(["Gamma Sand"]);
    expect((await listReceipts({ fundId: I.fund151 }, db)).rows.map((r) => r.payor)).toEqual(["Beta Quarry"]);
    expect((await listReceipts({ from: "2026-10-05", to: "2026-10-15" }, db)).rows.map((r) => r.payor)).toEqual(["Beta Quarry"]);
    expect((await listReceipts({ q: "quarry" }, db)).total).toBe(1);
    expect((await listReceipts({ q: "200" }, db)).rows.map((r) => r.controlNo)).toEqual([200]);
    expect((await listReceipts({ q: "no such payor" }, db)).total).toBe(0);
  });

  it("filters by deposit and shows the slip", async () => {
    const a = await post();
    await post();
    await recordDeposit({ officerId: I.officer1, receiptIds: [a.id], slipNo: "2026-140", date: "2026-10-16" }, null, db);
    expect((await listReceipts({ deposited: "yes" }, db)).rows.map((r) => [r.controlNo, r.depositSlip])).toEqual([[1, "2026-140"]]);
    expect((await listReceipts({ deposited: "no" }, db)).rows.map((r) => r.controlNo)).toEqual([2]);
  });

  it("pages the results", async () => {
    for (let i = 0; i < 7; i++) await post();
    const p1 = await listReceipts({ page: 1, pageSize: 3 }, db);
    const p3 = await listReceipts({ page: 3, pageSize: 3 }, db);
    expect(p1.total).toBe(7);
    expect(p1.rows.map((r) => r.controlNo)).toEqual([7, 6, 5]);
    expect(p3.rows.map((r) => r.controlNo)).toEqual([1]);
  });
});

describe("voiding from the receipt page", () => {
  it("records who, when and why, and the receipt stays readable", async () => {
    const a = await post({ amount: "1500" });
    await voidReceipt(a.id, "Wrong amount written", null, db);
    const r = await getReceipt(a.id, db);
    expect(r?.r.status).toBe("voided");
    expect(r?.r.voidReason).toBe("Wrong amount written");
    expect(r?.r.voidedAt).toBeInstanceOf(Date);
    expect(r?.lines[0].cents).toBe(150_000);
  });

  it("will not void a receipt that is on a deposit, until the deposit is gone", async () => {
    const a = await post();
    await recordDeposit({ officerId: I.officer1, receiptIds: [a.id], slipNo: "2026-141", date: "2026-10-16" }, null, db);
    await expect(voidReceipt(a.id, "Wrong payor written", null, db)).rejects.toThrow(/deposit/i);
    expect((await getReceipt(a.id, db))?.r.status).toBe("posted");
  });

  it("will not let a voided receipt go onto a deposit", async () => {
    const a = await post();
    await voidReceipt(a.id, "Wrong payor written", null, db);
    await expect(recordDeposit({ officerId: I.officer1, receiptIds: [a.id], slipNo: "2026-142", date: "2026-10-16" }, null, db)).rejects.toThrow(/voided/);
  });
});
