import { describe, expect, it } from "vitest";
import { columnTotals, mrdc, rcd, revenue, sdc, type RDeposit, type RReceipt } from "@/services/reports/compute";

const PERMIT = 0;
const SUPV = 1;
const MISC = 2;
let no = 7378481;
function r(over: Omit<Partial<RReceipt>, "lines" | "totalCents"> & { lines: Array<[string, number, number]> }): RReceipt {
  const lines = over.lines.map(([nature, group, cents]) => ({ nature, group, cents, descriptions: [] }));
  return {
    controlNo: no++,
    date: "2026-10-05",
    payor: "Payor",
    officerId: 1,
    fundId: 1,
    division: "MTES",
    opNo: null,
    modes: ["Cash"],
    depositId: null,
    status: "posted",
    ...over,
    lines,
    totalCents: lines.reduce((a, l) => a + l.cents, 0),
  };
}

// The first deposit group of the October 1-15 RCD in the workbook: nine receipts, 36,000.00 in all.
const group1 = (): RReceipt[] =>
  [
    ["GEOLOGICAL SITE SCOPING", SUPV, 600000],
    ["APPLICATION FEE", PERMIT, 200000],
    ["APPLICATION FEE", PERMIT, 200000],
    ["APPLICATION FEE", PERMIT, 200000],
    ["VERIFICATION FEE", SUPV, 800000],
    ["APPLICATION FEE", PERMIT, 200000],
    ["VERIFICATION FEE", SUPV, 800000],
    ["EVALUATION FEE", PERMIT, 500000],
    ["REGISTRATION FEE", PERMIT, 100000],
  ].map(([n, g, c]) => r({ lines: [[n as string, g as number, c as number]], depositId: 1 }));

const dep1: RDeposit = { id: 1, slipNo: "2026-125", date: "2026-10-05", officerId: 1, bankMsgNo: "MSG-1" };

describe("column totals", () => {
  it("matches the workbook subtotal for the first deposit group", () => {
    const t = columnTotals(group1());
    expect(t.cents).toBe(3_600_000);
    expect(t.byGroup[PERMIT]).toBe(1_400_000);
    expect(t.byGroup[SUPV]).toBe(2_200_000);
  });
  it("ignores voided receipts", () => {
    const rs = [r({ lines: [["APPLICATION FEE", PERMIT, 200000]] }), r({ lines: [["APPLICATION FEE", PERMIT, 200000]], status: "voided" })];
    expect(columnTotals(rs).cents).toBe(200000);
  });
});

describe("rcd", () => {
  it("groups by deposit, carries the balance forward and reconciles", () => {
    no = 7378481;
    const g = group1();
    const open = r({ lines: [["CERTIFICATION FEE", MISC, 15000]], date: "2026-10-14" });
    const res = rcd({
      receipts: [...g, open],
      deposits: [dep1],
      openings: [{ officerId: 1, fundId: 1, cents: 1_300_000 }],
      officerId: 1,
      fundId: 1,
      from: "2026-10-01",
      to: "2026-10-15",
    });
    expect(res.balanceForward).toBe(1_300_000);
    expect(res.groups).toHaveLength(2);
    expect(res.groups[0].deposit?.slipNo).toBe("2026-125");
    expect(res.groups[0].subtotal.cents).toBe(3_600_000);
    expect(res.groups[1].deposit).toBeNull();
    expect(res.total.cents).toBe(3_615_000);
    expect(res.depositsCents).toBe(3_600_000);
    expect(res.undepositedCents).toBe(1_300_000 + 3_615_000 - 3_600_000);
    expect(res.orFrom).toBe(7378481);
    expect(res.orTo).toBe(7378490);
  });
  it("treats an earlier undeposited receipt as balance forward and counts its later deposit", () => {
    no = 7378600;
    const early = r({ lines: [["APPLICATION FEE", PERMIT, 200000]], date: "2026-09-29", depositId: 2 });
    const later: RDeposit = { id: 2, slipNo: "2026-130", date: "2026-10-02", officerId: 1, bankMsgNo: null };
    const res = rcd({ receipts: [early], deposits: [later], openings: [], officerId: 1, fundId: 1, from: "2026-10-01", to: "2026-10-15" });
    expect(res.balanceForward).toBe(200000);
    expect(res.depositsCents).toBe(200000);
    expect(res.undepositedCents).toBe(0);
  });
  it("lists voided receipts but keeps them out of the totals", () => {
    no = 7378700;
    const v = r({ lines: [["APPLICATION FEE", PERMIT, 200000]], status: "voided" });
    const ok = r({ lines: [["APPLICATION FEE", PERMIT, 100000]] });
    const res = rcd({ receipts: [v, ok], deposits: [], openings: [], officerId: 1, fundId: 1, from: "2026-10-01", to: "2026-10-15" });
    expect(res.groups[0].receipts).toHaveLength(2);
    expect(res.total.cents).toBe(100000);
    expect(res.orFrom).toBe(7378700);
  });
});

describe("mrdc", () => {
  it("shows cash on hand and an ending balance that equals what is undeposited", () => {
    no = 7378800;
    const g = group1().map((x) => ({ ...x, depositId: 1 }));
    const open = r({ lines: [["CERTIFICATION FEE", MISC, 15000]], date: "2026-10-14" });
    const res = mrdc({
      receipts: [...g, open],
      deposits: [dep1],
      openings: [{ officerId: 1, fundId: 1, cents: 1_300_000 }],
      officerId: 1,
      from: "2026-10-01",
      to: "2026-10-31",
    });
    expect(res.beginning).toBe(1_300_000);
    expect(res.collectionsCents).toBe(3_615_000);
    expect(res.depositsForMonth).toBe(3_600_000);
    expect(res.ending).toBe(1_300_000 + 3_615_000 - 3_600_000);
    expect(res.rows.at(-1)?.cashOnHandCents).toBe(res.ending);
  });
});

describe("sdc", () => {
  it("splits cash and checks and separates validated from in transit", () => {
    no = 7378900;
    const a = r({ lines: [["APPLICATION FEE", PERMIT, 200000]], depositId: 1 });
    const b = r({ lines: [["FILING FEE", PERMIT, 20_000_000]], modes: ["Check"], depositId: 1 });
    const d2: RDeposit = { id: 2, slipNo: "2026-126", date: "2026-10-09", officerId: 1, bankMsgNo: null };
    const c = r({ lines: [["APPLICATION FEE", PERMIT, 150000]], depositId: 2 });
    const res = sdc({ receipts: [a, b, c], deposits: [dep1, d2], from: "2026-10-01", to: "2026-10-31" });
    expect(res.rows[0].cashCents).toBe(200000);
    expect(res.rows[0].checkCents).toBe(20_000_000);
    expect(res.totalCents).toBe(20_350_000);
    expect(res.validatedCents).toBe(20_200_000);
    expect(res.inTransitCents).toBe(150000);
  });
});

describe("revenue", () => {
  it("totals by nature and account group", () => {
    no = 7379000;
    const rs = [
      r({ lines: [["APPLICATION FEE", PERMIT, 200000]] }),
      r({ lines: [["APPLICATION FEE", PERMIT, 200000], ["CERTIFICATION FEE", MISC, 5000]] }),
      r({ lines: [["APPLICATION FEE", PERMIT, 999]], status: "voided" }),
    ];
    const res = revenue({ receipts: rs, from: "2026-10-01", to: "2026-10-31" });
    expect(res.totalCents).toBe(405000);
    expect(res.groups[0].items[0]).toEqual({ nature: "APPLICATION FEE", count: 2, cents: 400000 });
    expect(res.groups[1].subtotalCents).toBe(5000);
  });
});

describe("voided receipts stay alongside the others", () => {
  const dep: RDeposit = { id: 9, slipNo: "2026-150", date: "2026-10-05", officerId: 1, bankMsgNo: "M" };
  function series() {
    no = 7380000;
    const n0 = r({ lines: [["APPLICATION FEE", PERMIT, 100000]], status: "voided" }); // before the first number used
    const n1 = r({ lines: [["APPLICATION FEE", PERMIT, 200000]], depositId: 9 });
    const n2 = r({ lines: [["APPLICATION FEE", PERMIT, 300000]], status: "voided" }); // between a deposited and an undeposited one
    const n3 = r({ lines: [["APPLICATION FEE", PERMIT, 400000]] });
    const n4 = r({ lines: [["APPLICATION FEE", PERMIT, 500000]], status: "voided" }); // after the last number used
    return [n3, n4, n0, n2, n1]; // deliberately out of order
  }

  it("RCD: each voided receipt sits with the receipt before it, in number order", () => {
    const res = rcd({ receipts: series(), deposits: [dep], openings: [], officerId: 1, fundId: 1, from: "2026-10-01", to: "2026-10-15" });
    expect(res.groups.map((g) => g.deposit?.slipNo ?? "open")).toEqual(["2026-150", "open"]);
    // The voided one before the first number joins the first group; the one between stays with the number before it.
    expect(res.groups[0].receipts.map((x) => x.controlNo)).toEqual([7380000, 7380001, 7380002]);
    expect(res.groups[1].receipts.map((x) => x.controlNo)).toEqual([7380003, 7380004]);
    // Nothing voided is counted, whichever group it sits in.
    expect(res.groups[0].subtotal.cents).toBe(200000);
    expect(res.groups[1].subtotal.cents).toBe(400000);
    expect(res.total.cents).toBe(600000);
    expect(res.orFrom).toBe(7380000);
    expect(res.orTo).toBe(7380004);
  });

  it("RCD: voided receipts alone form their own group rather than vanishing", () => {
    no = 7381000;
    const only = r({ lines: [["APPLICATION FEE", PERMIT, 100000]], status: "voided" });
    const res = rcd({ receipts: [only], deposits: [], openings: [], officerId: 1, fundId: 1, from: "2026-10-01", to: "2026-10-15" });
    expect(res.groups).toHaveLength(1);
    expect(res.groups[0].receipts).toHaveLength(1);
    expect(res.total.cents).toBe(0);
  });

  it("Monthly report: the OR range of a row includes the voided numbers beside it", () => {
    const res = mrdc({ receipts: series(), deposits: [dep], openings: [], officerId: 1, from: "2026-10-01", to: "2026-10-31" });
    expect(res.rows.map((x) => [x.orFrom, x.orTo])).toEqual([[7380000, 7380002], [7380003, 7380004]]);
    expect(res.rows.map((x) => x.collectedCents)).toEqual([200000, 400000]);
    expect(res.collectionsCents).toBe(600000);
  });
});
