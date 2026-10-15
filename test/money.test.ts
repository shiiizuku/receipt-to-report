import { describe, expect, it } from "vitest";
import { fmt, fromCents, toCents } from "@/lib/money";
import { amountInWords } from "@/lib/words";

describe("money", () => {
  it("parses strings and numbers to centavos without float drift", () => {
    expect(toCents("72,500.00")).toBe(7_250_000);
    expect(toCents("0.1")).toBe(10);
    expect(toCents("1200")).toBe(120_000);
    expect(toCents(96750.5)).toBe(9_675_050);
    expect(toCents("")).toBe(0);
    expect(toCents("₱ 8,000.5")).toBe(800_050);
  });
  it("formats centavos", () => {
    expect(fromCents(7_250_000)).toBe("72500.00");
    expect(fromCents(5)).toBe("0.05");
    expect(fmt(448_680_00)).toBe("448,680.00");
  });
});

describe("amountInWords", () => {
  it("writes whole pesos", () => {
    expect(amountInWords(7_250_000)).toBe("Seventy-two thousand five hundred pesos only");
    expect(amountInWords(100_000)).toBe("One thousand pesos only");
    expect(amountInWords(20_000_000)).toBe("Two hundred thousand pesos only");
  });
  it("writes centavos", () => {
    expect(amountInWords(9_675_050)).toBe("Ninety-six thousand seven hundred fifty pesos and 50/100");
    expect(amountInWords(5)).toBe("Zero pesos and 5/100");
  });
  it("handles millions", () => {
    expect(amountInWords(502_035_188)).toBe("Five million twenty thousand three hundred fifty-one pesos and 88/100");
  });
});
