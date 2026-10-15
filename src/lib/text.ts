const KEEP_UPPER = new Set(["COE", "CEMCRR", "EGGAR", "OTP", "MPSA", "EXPA", "ISGPA", "IPA", "GAR", "MOEP", "EP"]);

/** "REGISTRATION FEE" → "Registration Fee", keeping acronyms upper case. */
export function titleCase(s: string): string {
  return s
    .toLowerCase()
    .replace(/(^|[\s/(&-])([a-z])/g, (_, a: string, b: string) => a + b.toUpperCase())
    .replace(/\b[A-Za-z]+\b/g, (w) => (KEEP_UPPER.has(w.toUpperCase()) ? w.toUpperCase() : w));
}

/** "JUAN A. CRUZ" → "Cruz" */
export function surname(name: string): string {
  const w = name.trim().split(/\s+/).pop() ?? "";
  return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
}

/** "JUAN A. CRUZ" → "Juan" */
export function firstName(name: string): string {
  const w = name.trim().split(/\s+/)[0] ?? "";
  return w.charAt(0).toUpperCase() + w.slice(1).toLowerCase();
}
