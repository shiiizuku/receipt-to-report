/** Money is handled as integer centavos in code and numeric(14,2) in the database. */

export function toCents(value: string | number): number {
  if (typeof value === "number") return Math.round(value * 100);
  const cleaned = value.replace(/[^0-9.\-]/g, "");
  if (!cleaned || cleaned === "." || cleaned === "-") return 0;
  const [whole, frac = ""] = cleaned.split(".");
  const sign = whole.startsWith("-") ? -1 : 1;
  const w = Number(whole.replace("-", "") || "0");
  const f = Number((frac + "00").slice(0, 2));
  return sign * (w * 100 + f);
}

export function fromCents(cents: number): string {
  const sign = cents < 0 ? "-" : "";
  const abs = Math.abs(cents);
  return `${sign}${Math.floor(abs / 100)}.${String(abs % 100).padStart(2, "0")}`;
}

const nf = new Intl.NumberFormat("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** 12,345.60 (no currency sign), used in report tables. */
export function fmt(cents: number): string {
  return nf.format(cents / 100);
}

/** Same as fmt, but blank for zero (report cells that are not used). */
export function fmtBlank(cents: number): string {
  return cents ? fmt(cents) : "";
}

export function peso(cents: number): string {
  return `₱ ${fmt(cents)}`;
}
