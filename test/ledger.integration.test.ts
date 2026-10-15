import { eq, sql } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { cancelDeposit, recordDeposit, validateDeposit } from "@/services/deposits";
import { listBooks, registerBook, setActiveBook } from "@/services/books";
import { listReceipts, postReceipt, voidReceipt, type PostReceiptInput } from "@/services/receipts";
import { loadReportData } from "@/services/report-data";
import { rcd } from "@/services/reports/compute";
import { db, ids, resetDb, schema } from "./helpers";

let I: Awaited<ReturnType<typeof ids>>;

function receipt(over: Partial<PostReceiptInput> = {}): PostReceiptInput {
  return {
    date: "2026-10-16",
    payor: "Santos Mining Corp.",
    officerId: I.officer1,
    fundId: I.fund101,
    division: "MTES",
    opNo: "202610022",
    modes: ["Cash"],
    lines: [{ natureId: I.nature("APPLICATION FEE"), amount: "2000", descriptions: ["OTP - LIMESTONE"] }],
    ...over,
  };
}

beforeEach(async () => {
  await resetDb();
  I = await ids();
});

describe("OR books", () => {
  it("activates the first book for an officer and refuses overlapping ranges", async () => {
    const a = await registerBook({ fromNo: 7378501, toNo: 7378550, officerId: I.officer1, receivedOn: "2026-09-08" }, null, db);
    expect(a.isActive).toBe(true);
    const b = await registerBook({ fromNo: 7378551, toNo: 7378600, officerId: I.officer1, receivedOn: "2026-10-05" }, null, db);
    expect(b.isActive).toBe(false);
    await expect(
      registerBook({ fromNo: 7378540, toNo: 7378560, officerId: I.officer2, receivedOn: "2026-10-05" }, null, db),
    ).rejects.toThrow(/overlap/i);
  });

  it("keeps only one active book per officer", async () => {
    const a = await registerBook({ fromNo: 100, toNo: 109, officerId: I.officer1, receivedOn: "2026-10-01" }, null, db);
    const b = await registerBook({ fromNo: 110, toNo: 119, officerId: I.officer1, receivedOn: "2026-10-01" }, null, db);
    await setActiveBook(b.id, null, db);
    const books = await listBooks(db);
    expect(books.find((x) => x.id === a.id)?.isActive).toBe(false);
    expect(books.find((x) => x.id === b.id)?.isActive).toBe(true);
  });
});

describe("posting receipts", () => {
  it("issues consecutive control numbers, even under concurrent posting", async () => {
    await registerBook({ fromNo: 1000, toNo: 1049, officerId: I.officer1, receivedOn: "2026-10-01" }, null, db);
    const results = await Promise.all(Array.from({ length: 15 }, () => postReceipt(receipt(), null, db)));
    const nos = results.map((r) => r.controlNo).sort((x, y) => x - y);
    expect(nos).toEqual(Array.from({ length: 15 }, (_, i) => 1000 + i));
    const [book] = await listBooks(db);
    expect(book.nextNo).toBe(1015);
    expect(book.left).toBe(35);
  });

  it("moves to the officer's next unopened book when one runs out", async () => {
    await registerBook({ fromNo: 1, toNo: 2, officerId: I.officer1, receivedOn: "2026-10-01" }, null, db);
    await registerBook({ fromNo: 3, toNo: 4, officerId: I.officer1, receivedOn: "2026-10-01" }, null, db);
    await postReceipt(receipt(), null, db);
    const last = await postReceipt(receipt(), null, db);
    expect(last.bookExhausted).toBe(true);
    expect(last.nextBookNo).toBe(2);
    const third = await postReceipt(receipt(), null, db);
    expect(third.controlNo).toBe(3);
  });

  it("refuses to post without an active book", async () => {
    await expect(postReceipt(receipt(), null, db)).rejects.toThrow(/active OR book/);
  });

  it("drops the order-of-payment number for MTSS", async () => {
    await registerBook({ fromNo: 1, toNo: 9, officerId: I.officer1, receivedOn: "2026-10-01" }, null, db);
    const r = await postReceipt(receipt({ division: "MTSS", opNo: "999" }), null, db);
    const [row] = await db.select().from(schema.receipts).where(eq(schema.receipts.id, r.id));
    expect(row.opNo).toBeNull();
  });

  it("validates the input", async () => {
    await registerBook({ fromNo: 1, toNo: 9, officerId: I.officer1, receivedOn: "2026-10-01" }, null, db);
    await expect(postReceipt(receipt({ payor: "  " }), null, db)).rejects.toThrow(/payor/i);
    await expect(postReceipt(receipt({ lines: [{ natureId: I.nature("FILING FEE"), amount: "0", descriptions: [] }] }), null, db)).rejects.toThrow(/above zero/);
    await expect(postReceipt(receipt({ modes: [] }), null, db)).rejects.toThrow(/payment/i);
  });

  it("will not let a voided receipt lose its reason, even directly in the database", async () => {
    await registerBook({ fromNo: 1, toNo: 9, officerId: I.officer1, receivedOn: "2026-10-01" }, null, db);
    const r = await postReceipt(receipt(), null, db);
    await voidReceipt(r.id, "Wrong payor written", null, db);
    await expect(db.update(schema.receipts).set({ voidReason: null }).where(eq(schema.receipts.id, r.id))).rejects.toThrow();
  });
});

describe("voiding", () => {
  it("keeps the control number used and out of the reports", async () => {
    await registerBook({ fromNo: 1, toNo: 9, officerId: I.officer1, receivedOn: "2026-10-01" }, null, db);
    const a = await postReceipt(receipt(), null, db);
    await voidReceipt(a.id, "Wrong payor name", null, db);
    const b = await postReceipt(receipt(), null, db);
    expect(b.controlNo).toBe(2);
    const data = await loadReportData("2026-10-31", db);
    const res = rcd({ ...data, officerId: I.officer1, fundId: I.fund101, from: "2026-10-16", to: "2026-10-31" });
    expect(res.groups[0].receipts).toHaveLength(2);
    expect(res.total.cents).toBe(200000);
    const voided = await listReceipts({ status: "voided" }, db);
    expect(voided.rows.map((r) => r.controlNo)).toEqual([1]);
  });

  it("needs a reason, cannot repeat, and cannot touch a deposited receipt", async () => {
    await registerBook({ fromNo: 1, toNo: 9, officerId: I.officer1, receivedOn: "2026-10-01" }, null, db);
    const a = await postReceipt(receipt(), null, db);
    await expect(voidReceipt(a.id, "no", null, db)).rejects.toThrow(/reason/);
    await recordDeposit({ officerId: I.officer1, receiptIds: [a.id], slipNo: "2026-134", date: "2026-10-16" }, null, db);
    await expect(voidReceipt(a.id, "Entered twice", null, db)).rejects.toThrow(/deposit/);
    await cancelDeposit((await db.select().from(schema.deposits))[0].id, null, db);
    await voidReceipt(a.id, "Entered twice", null, db);
    await expect(voidReceipt(a.id, "Entered twice", null, db)).rejects.toThrow(/already voided/);
  });
});

describe("deposits", () => {
  it("records, validates and cancels deposits", async () => {
    await registerBook({ fromNo: 1, toNo: 9, officerId: I.officer1, receivedOn: "2026-10-01" }, null, db);
    await registerBook({ fromNo: 20, toNo: 29, officerId: I.officer2, receivedOn: "2026-10-01" }, null, db);
    const a = await postReceipt(receipt(), null, db);
    const b = await postReceipt(receipt({ modes: ["Check"], instruments: [{ kind: "Check", bank: "Bank", number: "0034871", date: "2026-10-15" }] }), null, db);
    const other = await postReceipt(receipt({ officerId: I.officer2 }), null, db);

    await expect(recordDeposit({ officerId: I.officer1, receiptIds: [a.id, other.id], slipNo: "2026-140", date: "2026-10-16" }, null, db)).rejects.toThrow(/one collecting officer/);
    const dep = await recordDeposit({ officerId: I.officer1, receiptIds: [a.id, b.id], slipNo: "2026-140", date: "2026-10-16" }, null, db);
    expect(dep.totalCents).toBe(400000);
    await expect(recordDeposit({ officerId: I.officer1, receiptIds: [a.id], slipNo: "2026-141", date: "2026-10-16" }, null, db)).rejects.toThrow(/already on a deposit/);

    await validateDeposit(dep.id, "LBP-261016-0001", null, db);
    await expect(cancelDeposit(dep.id, null, db)).rejects.toThrow(/validated/);
    await expect(validateDeposit(dep.id, "x", null, db)).rejects.toThrow(/already validated/);
  });

  it("refuses a duplicate slip number", async () => {
    await registerBook({ fromNo: 1, toNo: 9, officerId: I.officer1, receivedOn: "2026-10-01" }, null, db);
    const a = await postReceipt(receipt(), null, db);
    const b = await postReceipt(receipt(), null, db);
    await recordDeposit({ officerId: I.officer1, receiptIds: [a.id], slipNo: "2026-140", date: "2026-10-16" }, null, db);
    await expect(recordDeposit({ officerId: I.officer1, receiptIds: [b.id], slipNo: "2026-140", date: "2026-10-16" }, null, db)).rejects.toThrow(/already recorded/);
  });
});

describe("audit trail", () => {
  it("records actions and cannot be edited or deleted", async () => {
    await registerBook({ fromNo: 1, toNo: 9, officerId: I.officer1, receivedOn: "2026-10-01" }, null, db);
    const a = await postReceipt(receipt(), null, db);
    const events = await db.select().from(schema.auditEvents);
    expect(events.map((e) => e.action)).toEqual(expect.arrayContaining(["book.register", "receipt.post"]));
    expect(events.find((e) => e.action === "receipt.post")?.entityId).toBe(String(a.id));
    await expect(db.execute(sql`UPDATE audit_events SET action = 'x'`)).rejects.toThrow();
    await expect(db.execute(sql`DELETE FROM audit_events`)).rejects.toThrow();
  });
});
