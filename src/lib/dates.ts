const TZ = "Asia/Manila";

export function todayISO(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

export function monthBounds(year: number, month: number): { from: string; to: string } {
  const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const mm = String(month).padStart(2, "0");
  return { from: `${year}-${mm}-01`, to: `${year}-${mm}-${String(last).padStart(2, "0")}` };
}

/** "1" is the 1st to 15th, "2" is the 16th to month end. */
export function halfBounds(year: number, month: number, half: "1" | "2"): { from: string; to: string; label: string } {
  const m = monthBounds(year, month);
  const mm = String(month).padStart(2, "0");
  const name = monthName(month);
  if (half === "1") return { from: m.from, to: `${year}-${mm}-15`, label: `${name} 1–15, ${year}` };
  return { from: `${year}-${mm}-16`, to: m.to, label: `${name} 16–${m.to.slice(8)}, ${year}` };
}

export function monthName(month: number): string {
  return new Date(Date.UTC(2000, month - 1, 1)).toLocaleDateString("en-US", { month: "long", timeZone: "UTC" });
}

export function fmtDate(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });
}

export function fmtShort(iso: string): string {
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-PH", { month: "short", day: "numeric", timeZone: "UTC" });
}

export function parseYearMonth(value: string | undefined, fallback: string): { year: number; month: number } {
  const m = /^(\d{4})-(\d{2})$/.exec(value ?? "") ?? /^(\d{4})-(\d{2})/.exec(fallback)!;
  return { year: Number(m[1]), month: Number(m[2]) };
}
