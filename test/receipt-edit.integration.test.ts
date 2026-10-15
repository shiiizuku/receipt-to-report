import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { listBooks, registerBook } from "@/services/books";
import { cancelDeposit, recordDeposit } from "@/services/deposits";
import { getReceipt, postReceipt, updateReceipt, voidReceipt, type PostReceiptInput, type UpdateReceiptInput } from "@/services/receipts";
import { loadReportData } from "@/services/report-data";
import { rcd } from "@/services/reports/compute";
import { db, ids, resetDb, schema } from "./helpers";

let I: Awaited<ReturnType<typeof ids>>;

function newReceipt(over: Partial<PostReceiptInput> = {}): PostReceiptInput {
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

/** The editable fields of a receipt, as the edit screen would send them back. */
function edit(over: Partial<UpdateReceiptInput> = {}): UpdateReceiptInput {
  const { officerId: _officerId, controlNo: _controlNo, ...rest } = newReceipt();
  return { ...rest, ...over };
}

async function setup() {
  await registerBook({ fromNo: 100, toNo: 109, officerId: I.officer1, receivedOn: "2026-10-01" }, null, db);
}

beforeEach(async () => {
  await resetDb();
  I = await ids();
});

describe("editing a receipt", () => {
  it("corrects details and records exactly what changed", async () => {
    await setup();
    const a = await postReceipt(newReceipt(), null, db);
    const r = await updateReceipt(a.id, edit({ payor: "Santos Mining Corporation", division: "GD", opNo: "202610099", date: "2026-10-15", lines: [{ natureId: I.nature("APPLICATION FEE"), amount: "2000", descriptions: ["ORE TRANSPORT PERMIT"] }] }), 7, db);
    expect(r.changed).toBe(true);
    const got = await getReceipt(a.id, db);
    expect(got?.r.payor).toBe("Santos Mining Corporation");
    expect(got?.r.division).toBe("GD");
    expect(got?.r.opNo).toBe("202610099");
    expect(got?.r.receiptDate).toBe("2026-10-15");
    expect(got?.lines[0].descriptions).toEqual(["ORE TRANSPORT PERMIT"]);

    const events = await db.select().from(schema.auditEvents).where(eq(schema.auditEvents.action, "receipt.edit"));
    expect(events).toHaveLength(1);
    expect(events[0].userId).toBe(7);
    const changes = (events[0].payload as { changes: Record<string, { from: unknown; to: unknown }> }).changes;
    expect(Object.keys(changes).sort()).toEqual(["date", "division", "lines", "opNo", "payor"]);
    expect(changes.payor).toEqual({ from: "Santos Mining Corp.", to: "Santos Mining Corporation" });
  });

  it("recalculates the total when lines change, and the reports follow", async () => {
    await setup();
    const a = await postReceipt(newReceipt(), null, db);
    await updateReceipt(
      a.id,
      edit({
        lines: [
          { natureId: I.nature("APPLICATION FEE"), amount: "2500.50", descriptions: [] },
          { natureId: I.nature("CERTIFICATION FEE"), amount: "50", descriptions: ["AREA STATUS / CLEARANCE"] },
        ],
      }),
      null,
      db,
    );
    const got = await getReceipt(a.id, db);
    expect(got?.r.total).toBe("2550.50");
    expect(got?.lines.map((l) => l.nature)).toEqual(["APPLICATION FEE", "CERTIFICATION FEE"]);
    const data = await loadReportData("2026-10-31", db);
    const res = rcd({ ...data, officerId: I.officer1, fundId: I.fund101, from: "2026-10-16", to: "2026-10-31" });
    expect(res.total.cents).toBe(255_050);
    expect(res.total.byGroup[0]).toBe(250_050);
    expect(res.total.byGroup[2]).toBe(5_000);
  });

  it("does nothing, and logs nothing, when nothing changed", async () => {
    await setup();
    const a = await postReceipt(newReceipt(), null, db);
    const r = await updateReceipt(a.id, edit(), null, db);
    expect(r.changed).toBe(false);
    expect(await db.select().from(schema.auditEvents).where(eq(schema.auditEvents.action, "receipt.edit"))).toHaveLength(0);
  });

  it("drops the order-of-payment number for MTSS", async () => {
    await setup();
    const a = await postReceipt(newReceipt(), null, db);
    await updateReceipt(a.id, edit({ division: "MTSS", opNo: "123" }), null, db);
    expect((await getReceipt(a.id, db))?.r.opNo).toBeNull();
  });

  it("validates like posting does", async () => {
    await setup();
    const a = await postReceipt(newReceipt(), null, db);
    await expect(updateReceipt(a.id, edit({ payor: " " }), null, db)).rejects.toThrow(/payor/i);
    await expect(updateReceipt(a.id, edit({ lines: [{ natureId: I.nature("FILING FEE"), amount: "0", descriptions: [] }] }), null, db)).rejects.toThrow(/above zero/);
    await expect(updateReceipt(999999, edit(), null, db)).rejects.toThrow(/does not exist/);
  });

  it("edits a voided receipt too, and it stays out of every total", async () => {
    await setup();
    const a = await postReceipt(newReceipt(), null, db);
    await voidReceipt(a.id, "Wrong payor written", null, db);
    const r = await updateReceipt(
      a.id,
      edit({ payor: "Corrected Payor", lines: [{ natureId: I.nature("FILING FEE"), amount: "9999", descriptions: ["EXPA"] }], voidReason: "Wrong payor and amount written" }),
      7,
      db,
    );
    expect(r.changed).toBe(true);
    const got = await getReceipt(a.id, db);
    expect(got?.r.status).toBe("voided");
    expect(got?.r.payor).toBe("Corrected Payor");
    expect(got?.r.voidReason).toBe("Wrong payor and amount written");
    expect(got?.r.total).toBe("9999.00");

    const data = await loadReportData("2026-10-31", db);
    const res = rcd({ ...data, officerId: I.officer1, fundId: I.fund101, from: "2026-10-16", to: "2026-10-31" });
    expect(res.total.cents).toBe(0); // still voided, so nothing is counted
    expect(res.groups[0].receipts).toHaveLength(1);

    const events = await db.select().from(schema.auditEvents).where(eq(schema.auditEvents.action, "receipt.edit"));
    const payload = events[0].payload as { voided?: boolean; changes: Record<string, unknown> };
    expect(payload.voided).toBe(true);
    expect(Object.keys(payload.changes)).toContain("voidReason");
  });

  it("keeps the void reason when it is not sent, and needs a real one when it is", async () => {
    await setup();
    const a = await postReceipt(newReceipt(), null, db);
    await voidReceipt(a.id, "Wrong payor written", null, db);
    await updateReceipt(a.id, edit({ payor: "Changed Again" }), null, db);
    expect((await getReceipt(a.id, db))?.r.voidReason).toBe("Wrong payor written");
    await expect(updateReceipt(a.id, edit({ voidReason: "no" }), null, db)).rejects.toThrow(/reason/i);
  });

  it("can move a voided receipt to another number, and the number is still accounted for", async () => {
    await setup();
    const a = await postReceipt(newReceipt(), null, db);
    await voidReceipt(a.id, "Wrong payor written", null, db);
    await updateReceipt(a.id, edit({ controlNo: 104 }), null, db);
    const [book] = await listBooks(db);
    expect((await getReceipt(a.id, db))?.r.controlNo).toBe(104);
    expect(book.nextNo).toBe(105);
    expect(book.gaps).toEqual([100, 101, 102, 103]);
  });
});

describe("editing a deposited receipt", () => {
  it("allows corrections that do not touch the money, and refuses the rest", async () => {
    await setup();
    const a = await postReceipt(newReceipt(), null, db);
    await recordDeposit({ officerId: I.officer1, receiptIds: [a.id], slipNo: "2026-140", date: "2026-10-16" }, null, db);

    // Payor, nature, description, division, order of payment: fine.
    await updateReceipt(a.id, edit({ payor: "Corrected Payor", division: "FAD", opNo: "555", lines: [{ natureId: I.nature("VERIFICATION FEE"), amount: "2000", descriptions: ["OTP"] }] }), null, db);
    expect((await getReceipt(a.id, db))?.lines[0].nature).toBe("VERIFICATION FEE");

    const locked = /deposit slip 2026-140/;
    await expect(updateReceipt(a.id, edit({ lines: [{ natureId: I.nature("APPLICATION FEE"), amount: "2100", descriptions: [] }] }), null, db)).rejects.toThrow(locked);
    await expect(updateReceipt(a.id, edit({ date: "2026-10-10" }), null, db)).rejects.toThrow(locked);
    await expect(updateReceipt(a.id, edit({ fundId: I.fund151 }), null, db)).rejects.toThrow(locked);
    await expect(updateReceipt(a.id, edit({ modes: ["Check"], instruments: [{ kind: "Check", bank: "B", number: "1", date: "2026-10-16" }] }), null, db)).rejects.toThrow(locked);
    await expect(
      updateReceipt(a.id, edit({ lines: [{ natureId: I.nature("APPLICATION FEE"), amount: "2000", descriptions: [] }, { natureId: I.nature("FILING FEE"), amount: "10", descriptions: [] }] }), null, db),
    ).rejects.toThrow(locked);

    // Remove the deposit and the money fields can change again.
    await cancelDeposit((await db.select().from(schema.deposits))[0].id, null, db);
    await updateReceipt(a.id, edit({ lines: [{ natureId: I.nature("APPLICATION FEE"), amount: "2100", descriptions: [] }] }), null, db);
    expect((await getReceipt(a.id, db))?.r.total).toBe("2100.00");
  });
});

describe("changing the OR control number", () => {
  it("moves a receipt to an unused number in the same book and tracks what that leaves behind", async () => {
    await setup();
    const a = await postReceipt(newReceipt(), null, db);
    await postReceipt(newReceipt(), null, db);
    const c = await postReceipt(newReceipt(), null, db);
    expect([a.controlNo, c.controlNo]).toEqual([100, 102]);

    await updateReceipt(a.id, edit({ controlNo: 105 }), null, db);
    expect((await getReceipt(a.id, db))?.r.controlNo).toBe(105);
    let [book] = await listBooks(db);
    expect(book.nextNo).toBe(106);
    expect(book.gaps).toEqual([100, 103, 104]); // 100 was freed; 103 and 104 were never used

    // Move it back down: the suggested next number follows the highest number now used.
    await updateReceipt(a.id, edit({ controlNo: 100 }), null, db);
    [book] = await listBooks(db);
    expect(book.nextNo).toBe(103);
    expect(book.gaps).toEqual([]);

    const events = await db.select().from(schema.auditEvents).where(eq(schema.auditEvents.action, "receipt.edit"));
    expect(events).toHaveLength(2);
    expect((events[0].payload as { changes: { controlNo: unknown } }).changes.controlNo).toEqual({ from: 100, to: 105 });
  });

  it("refuses a number another receipt has, one outside the officer's books, or another officer's book", async () => {
    await setup();
    await registerBook({ fromNo: 200, toNo: 209, officerId: I.officer2, receivedOn: "2026-10-01" }, null, db);
    const a = await postReceipt(newReceipt(), null, db);
    const b = await postReceipt(newReceipt(), null, db);
    await expect(updateReceipt(a.id, edit({ controlNo: b.controlNo }), null, db)).rejects.toThrow(/already used by another receipt/);
    await expect(updateReceipt(a.id, edit({ controlNo: 500 }), null, db)).rejects.toThrow(/not in any of this officer's registered books/);
    await expect(updateReceipt(a.id, edit({ controlNo: 205 }), null, db)).rejects.toThrow(/not in any of this officer's registered books/);
    expect((await getReceipt(a.id, db))?.r.controlNo).toBe(100);
  });

  it("can move a receipt into another of the officer's books", async () => {
    await setup();
    await registerBook({ fromNo: 300, toNo: 309, officerId: I.officer1, receivedOn: "2026-10-01" }, null, db);
    const a = await postReceipt(newReceipt(), null, db);
    await updateReceipt(a.id, edit({ controlNo: 304 }), null, db);
    const books = await listBooks(db);
    const first = books.find((x) => x.fromNo === 100)!;
    const second = books.find((x) => x.fromNo === 300)!;
    expect((await getReceipt(a.id, db))?.r.bookId).toBe(second.id);
    expect(first.nextNo).toBe(100);
    expect(second.nextNo).toBe(305);
    expect(second.gaps).toEqual([300, 301, 302, 303]);
  });

  it("works on a deposited receipt, because the number does not change the deposit", async () => {
    await setup();
    const a = await postReceipt(newReceipt(), null, db);
    await recordDeposit({ officerId: I.officer1, receiptIds: [a.id], slipNo: "2026-141", date: "2026-10-16" }, null, db);
    await updateReceipt(a.id, edit({ controlNo: 103 }), null, db);
    expect((await getReceipt(a.id, db))?.r.controlNo).toBe(103);
  });
});

describe("posting with a chosen number", () => {
  it("fills a gap without moving the suggested next number", async () => {
    await setup();
    await postReceipt(newReceipt({ controlNo: 103 }), null, db);
    let [book] = await listBooks(db);
    expect(book.nextNo).toBe(104);
    expect(book.gaps).toEqual([100, 101, 102]);

    const filled = await postReceipt(newReceipt({ controlNo: 101 }), null, db);
    expect(filled.controlNo).toBe(101);
    [book] = await listBooks(db);
    expect(book.nextNo).toBe(104);
    expect(book.gaps).toEqual([100, 102]);

    // Without a chosen number, posting carries on after the highest.
    expect((await postReceipt(newReceipt(), null, db)).controlNo).toBe(104);
  });

  it("refuses numbers that are used, or not in the officer's books", async () => {
    await setup();
    await registerBook({ fromNo: 200, toNo: 209, officerId: I.officer2, receivedOn: "2026-10-01" }, null, db);
    await postReceipt(newReceipt({ controlNo: 102 }), null, db);
    await expect(postReceipt(newReceipt({ controlNo: 102 }), null, db)).rejects.toThrow(/already used/);
    await expect(postReceipt(newReceipt({ controlNo: 9999 }), null, db)).rejects.toThrow(/not in any of this officer's registered books/);
    await expect(postReceipt(newReceipt({ controlNo: 201 }), null, db)).rejects.toThrow(/not in any of this officer's registered books/);
  });

  it("lets only one of two simultaneous posts have the same number", async () => {
    await setup();
    const results = await Promise.allSettled([postReceipt(newReceipt({ controlNo: 107 }), null, db), postReceipt(newReceipt({ controlNo: 107 }), null, db)]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const failed = results.find((r) => r.status === "rejected") as PromiseRejectedResult;
    expect(String(failed.reason.message)).toMatch(/already used|just used/);
  });

  it("uses a number that makes its book run out, and moves on", async () => {
    await registerBook({ fromNo: 1, toNo: 3, officerId: I.officer1, receivedOn: "2026-10-01" }, null, db);
    await registerBook({ fromNo: 4, toNo: 6, officerId: I.officer1, receivedOn: "2026-10-01" }, null, db);
    const r = await postReceipt(newReceipt({ controlNo: 3 }), null, db);
    expect(r.bookExhausted).toBe(true);
    expect(r.nextBookNo).toBe(2);
    // Numbers 1 and 2 were skipped, so that book shows two unaccounted numbers.
    const [first] = await listBooks(db);
    expect(first.gaps).toEqual([1, 2]);
    expect(first.status).toBe("exhausted");
  });
});
