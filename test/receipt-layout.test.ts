import { describe, expect, it } from "vitest";
import { FIELD, ROW_COUNT, placeRows, wrapWords } from "@/lib/receipt-layout";

describe("placeRows", () => {
  it("puts a description on the row under its nature", () => {
    const { rows, overflow } = placeRows([
      { nature: "ROYALTY FEE", cents: 7_250_000, descriptions: ["90% OF 5% INCOME", "MPSA NO. 226-2005-III"] },
      { nature: "REGISTRATION FEE", cents: 150_000, descriptions: [] },
    ]);
    expect(rows.map((r) => [r.kind, r.text])).toEqual([
      ["nature", "ROYALTY FEE"],
      ["description", "90% OF 5% INCOME"],
      ["description", "MPSA NO. 226-2005-III"],
      ["nature", "REGISTRATION FEE"],
    ]);
    expect(rows[0].cents).toBe(7_250_000);
    expect(rows[1].cents).toBeUndefined();
    expect(overflow).toBe(false);
  });

  it("flags more rows than the form has, and keeps only what fits", () => {
    const lines = Array.from({ length: 4 }, (_, i) => ({ nature: `FEE ${i}`, cents: 100, descriptions: ["A", "B"] }));
    const { rows, overflow } = placeRows(lines);
    expect(rows).toHaveLength(ROW_COUNT);
    expect(overflow).toBe(true);
  });

  it("fits eight natures with no descriptions exactly", () => {
    const { rows, overflow } = placeRows(Array.from({ length: 8 }, (_, i) => ({ nature: `FEE ${i}`, cents: 100, descriptions: [] })));
    expect(rows).toHaveLength(8);
    expect(overflow).toBe(false);
  });
});

describe("wrapWords", () => {
  it("wraps at word boundaries", () => {
    expect(wrapWords("Two hundred eighty thousand one hundred thirty pesos only", 30)).toEqual([
      "Two hundred eighty thousand",
      "one hundred thirty pesos only",
    ]);
  });
  it("keeps a long single word whole", () => {
    expect(wrapWords("Supercalifragilistic pesos", 8)).toEqual(["Supercalifragilistic", "pesos"]);
  });
  it("handles empty text", () => {
    expect(wrapWords("", 20)).toEqual([]);
  });
});

describe("field positions", () => {
  it("keeps every field inside the form and in reading order", () => {
    const tops = [FIELD.date.top, FIELD.payor.top, FIELD.firstRowTop, FIELD.total.top, FIELD.words.top, FIELD.modeCash.top, FIELD.officer.top];
    expect([...tops].sort((a, b) => a - b)).toEqual(tops);
    for (const f of [FIELD.date, FIELD.agency, FIELD.fund, FIELD.payor, FIELD.nature, FIELD.amount, FIELD.total, FIELD.words, FIELD.officer]) {
      expect(f.left).toBeGreaterThanOrEqual(0);
      expect(f.left + f.width).toBeLessThanOrEqual(1.0001);
    }
    // The eighth row ends above the TOTAL line.
    expect(FIELD.firstRowTop + ROW_COUNT * FIELD.rowPitch).toBeLessThanOrEqual(FIELD.total.top + 0.005);
  });
});
