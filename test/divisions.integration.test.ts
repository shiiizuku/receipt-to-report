import { eq } from "drizzle-orm";
import { beforeEach, describe, expect, it } from "vitest";
import { registerBook } from "@/services/books";
import { addDivision } from "@/services/divisions";
import { getReceipt, postReceipt, updateReceipt } from "@/services/receipts";
import { getLookups } from "@/services/lookups";
import { buildReport } from "@/services/reports/build";
import { db, ids, resetDb, schema } from "./helpers";

let I: Awaited<ReturnType<typeof ids>>;

const base = () => ({
  date: "2026-10-16",
  payor: "Santos Mining Corp.",
  officerId: I.officer1,
  fundId: I.fund101,
  opNo: "202610022",
  modes: ["Cash" as const],
  lines: [{ natureId: I.nature("APPLICATION FEE"), amount: "2000", descriptions: [] }],
});

beforeEach(async () => {
  await resetDb();
  I = await ids();
  await registerBook({ fromNo: 1, toNo: 50, officerId: I.officer1, receivedOn: "2026-10-01" }, null, db);
});

describe("adding a division", () => {
  it("adds one to the list, after the others, and records who did it", async () => {
    const d = await addDivision({ code: " mgd ", rccCode: "06" }, 7, db);
    expect(d.code).toBe("MGD");
    expect(d.rccCode).toBe("06");
    expect(d.noOpNumber).toBe(false);
    const list = await getLookups(db);
    expect(list.divisions.map((x) => x.code)).toEqual(["MTES", "GD", "MSESDD", "FAD", "MTSS", "MGD"]);
    const [e] = await db.select().from(schema.auditEvents).where(eq(schema.auditEvents.action, "division.add"));
    expect(e.userId).toBe(7);
    expect(e.entityId).toBe("MGD");
  });

  it("accepts a division with no RCD code", async () => {
    const d = await addDivision({ code: "OARD", rccCode: "  " }, null, db);
    expect(d.rccCode).toBeNull();
  });

  it("refuses duplicates in any case, and bad names or codes", async () => {
    await expect(addDivision({ code: "mtes" }, null, db)).rejects.toThrow(/already a division called MTES/);
    await expect(addDivision({ code: "X" }, null, db)).rejects.toThrow(/2 to 16/);
    await expect(addDivision({ code: "BAD;DROP" }, null, db)).rejects.toThrow(/2 to 16/);
    await expect(addDivision({ code: "OKAY", rccCode: "ab" }, null, db)).rejects.toThrow(/RCD code/);
    await expect(addDivision({ code: "OKAY", rccCode: "1234" }, null, db)).rejects.toThrow(/RCD code/);
  });

  it("can be used on a receipt, and the RCD prints its code", async () => {
    await addDivision({ code: "MGD", rccCode: "06" }, null, db);
    const r = await postReceipt({ ...base(), division: "MGD" }, null, db);
    expect((await getReceipt(r.id, db))?.r.division).toBe("MGD");
    const rep = await buildReport({ type: "rcd", year: 2026, month: 10, half: "2", fundId: I.fund101, officerId: I.officer1 }, db);
    if (rep.kind !== "rcd") throw new Error("wrong model");
    expect(rep.divisionCodes.MGD).toBe("06");
  });
});

describe("divisions that control their own order-of-payment numbers", () => {
  it("MTSS is flagged from the start", async () => {
    const mtss = (await getLookups(db)).divisions.find((d) => d.code === "MTSS");
    expect(mtss?.noOpNumber).toBe(true);
  });

  it("a new flagged division leaves the order of payment blank, on posting and on editing", async () => {
    await addDivision({ code: "MGD", noOpNumber: true }, null, db);
    const r = await postReceipt({ ...base(), division: "MGD" }, null, db);
    expect((await getReceipt(r.id, db))?.r.opNo).toBeNull();

    const other = await postReceipt({ ...base(), division: "MTES" }, null, db);
    expect((await getReceipt(other.id, db))?.r.opNo).toBe("202610022");
    const { officerId: _o, ...rest } = base();
    await updateReceipt(other.id, { ...rest, division: "MGD" }, null, db);
    expect((await getReceipt(other.id, db))?.r.opNo).toBeNull();
  });

  it("an unflagged new division keeps the order of payment", async () => {
    await addDivision({ code: "OARD" }, null, db);
    const r = await postReceipt({ ...base(), division: "OARD" }, null, db);
    expect((await getReceipt(r.id, db))?.r.opNo).toBe("202610022");
  });

  it("an unknown division is refused", async () => {
    await expect(postReceipt({ ...base(), division: "NOPE" }, null, db)).rejects.toThrow(/does not exist/);
  });
});
