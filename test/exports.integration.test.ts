import ExcelJS from "exceljs";
import { beforeEach, describe, expect, it } from "vitest";
import { registerBook } from "@/services/books";
import { recordDeposit, validateDeposit } from "@/services/deposits";
import { buildWorkbook } from "@/services/exports/excel";
import { buildPdf } from "@/services/exports/pdf";
import { postReceipt, voidReceipt } from "@/services/receipts";
import { buildReport } from "@/services/reports/build";
import { db, ids, resetDb, schema } from "./helpers";

let I: Awaited<ReturnType<typeof ids>>;

beforeEach(async () => {
  await resetDb();
  I = await ids();
  await db.insert(schema.openingBalances).values({ officerId: I.officer1, fundId: I.fund101, asOf: "2026-10-01", amount: "13000.00" }).onConflictDoNothing();
  await registerBook({ fromNo: 7378501, toNo: 7378550, officerId: I.officer1, receivedOn: "2026-09-08" }, null, db);
});

async function post(date: string, payor: string, lines: Array<[string, string, string[]?]>, modes: Array<"Cash" | "Check"> = ["Cash"]) {
  return postReceipt(
    {
      date, payor, officerId: I.officer1, fundId: I.fund101, division: "MTES", opNo: "202610022", modes,
      lines: lines.map(([n, a, d]) => ({ natureId: I.nature(n), amount: a, descriptions: d ?? [] })),
    },
    null,
    db,
  );
}

const params = { type: "rcd" as const, year: 2026, month: 10, half: "1" as const };

describe("exports", () => {
  it("writes an RCD workbook whose totals match the report", async () => {
    const a = await post("2026-10-01", "Bagong Pag-asa Mining Corp.", [["APPLICATION FEE", "2000", ["OTP - LIMESTONE"]]]);
    const b = await post("2026-10-02", "Sierra Aggregates Inc.", [["VERIFICATION FEE", "8000", ["OTP"]], ["CERTIFICATION FEE", "50"]]);
    const c = await post("2026-10-03", "Void Payor", [["FILING FEE", "999"]]);
    await voidReceipt(c.id, "Entered twice by mistake", null, db);
    await recordDeposit({ officerId: I.officer1, receiptIds: [a.id, b.id], slipNo: "2026-129", date: "2026-10-05" }, null, db);
    await validateDeposit((await db.select().from(schema.deposits))[0].id, "LBP-0001", null, db);

    const model = await buildReport({ ...params, fundId: I.fund101, officerId: I.officer1, reportNo: "2026-09" }, db);
    if (model.kind !== "rcd") throw new Error("wrong model");
    expect(model.result.balanceForward).toBe(1_300_000);
    expect(model.result.total.cents).toBe(1_005_000);
    expect(model.result.depositsCents).toBe(1_005_000);
    expect(model.result.undepositedCents).toBe(1_300_000);

    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load((await buildWorkbook(model)) as unknown as ArrayBuffer);
    const ws = wb.getWorksheet("1-15")!;
    expect(ws.getCell("A1").value).toBe("REPORT OF COLLECTIONS AND DEPOSITS");
    expect(String(ws.getCell("A4").value)).toContain("Regional Office No. 3");
    expect(ws.getCell("P4").value).toBe("2026-09");
    expect(ws.getCell("K9").value).toBe(4020101000);

    const cells: Array<[string, unknown]> = [];
    ws.eachRow((row) => row.eachCell((cell) => cells.push([cell.address, cell.value])));
    const texts = cells.map(([, v]) => (typeof v === "object" && v !== null && "result" in v ? "" : String(v)));
    expect(texts).toContain("Application Fee");
    expect(texts).toContain("OTP - LIMESTONE");
    expect(texts).toContain("CANCELLED");
    expect(texts.some((t) => t.includes("Deposit slip 2026-129"))).toBe(true);
    // The formulas carry cached results so the file reads correctly before Excel recalculates.
    const subtotal = cells.find(([, v]) => typeof v === "object" && v !== null && "formula" in v && (v as unknown as { result: number }).result === 10050);
    expect(subtotal).toBeTruthy();
    expect(texts).toContain("JUAN A. CRUZ");
  });

  it("writes the other three reports and every PDF", async () => {
    const a = await post("2026-10-01", "Payor A", [["APPLICATION FEE", "2000"]], ["Cash"]);
    const b = await post("2026-10-02", "Payor B", [["FILING FEE", "200000"]], ["Check"]);
    await recordDeposit({ officerId: I.officer1, receiptIds: [a.id, b.id], slipNo: "2026-129", date: "2026-10-05" }, null, db);

    for (const type of ["rcd", "mrdc", "sdc", "rev"] as const) {
      const model = await buildReport({ ...params, type, fundId: I.fund101, officerId: I.officer1 }, db);
      const xlsx = await buildWorkbook(model);
      expect(xlsx.subarray(0, 2).toString()).toBe("PK");
      const pdf = await buildPdf(model);
      expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
      expect(pdf.length).toBeGreaterThan(1500);
    }

    const sdc = await buildReport({ ...params, type: "sdc" }, db);
    if (sdc.kind !== "sdc") throw new Error("wrong model");
    expect(sdc.result.cashCents).toBe(200_000);
    expect(sdc.result.checkCents).toBe(20_000_000);
    expect(sdc.result.inTransitCents).toBe(20_200_000);

    const rev = await buildReport({ ...params, type: "rev" }, db);
    if (rev.kind !== "rev") throw new Error("wrong model");
    expect(rev.result.totalCents).toBe(20_200_000);
    expect(rev.result.groups.map((g) => g.group)).toEqual([0]);
  });

  it("keeps edited signatories and officer titles", async () => {
    await db.update(schema.signatories).set({ name: "NEW PERSON", title: "Chief, Cashiering Section" }).where(
      (await import("drizzle-orm")).eq(schema.signatories.key, "mrdc.prepared"),
    );
    const model = await buildReport({ ...params, type: "mrdc", officerId: I.officer1 }, db);
    if (model.kind !== "mrdc") throw new Error("wrong model");
    expect(model.signatories[0].name).toBe("NEW PERSON");
  });
});
