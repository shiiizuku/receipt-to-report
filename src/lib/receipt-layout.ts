/**
 * Where the typed values go on the pre-printed Official Receipt (Accountable Form No. 51-C).
 * Positions are fractions of the form's width and height, measured from the sample copy of the form,
 * so they scale with the form width set in the print preview. Print preview lets the person nudge
 * them to match their own booklet.
 */

/** Height of the form as a multiple of its width. */
export const FORM_ASPECT = 2.06;
export const DEFAULT_FORM_WIDTH_MM = 105;
export const ROW_COUNT = 8;

export const FIELD = {
  date: { left: 0.44, top: 0.172, width: 0.54 },
  agency: { left: 0.19, top: 0.222, width: 0.57 },
  fund: { left: 0.8, top: 0.222, width: 0.19 },
  payor: { left: 0.14, top: 0.27, width: 0.84 },
  firstRowTop: 0.364,
  rowPitch: 0.0292,
  nature: { left: 0.025, width: 0.5 },
  amount: { left: 0.74, width: 0.245 },
  total: { left: 0.74, top: 0.616, width: 0.245 },
  words: { left: 0.035, top: 0.686, width: 0.93, pitch: 0.026 },
  modeCash: { left: 0.04, top: 0.733 },
  modeCheck: { left: 0.04, top: 0.769 },
  modeMoneyOrder: { left: 0.04, top: 0.803 },
  checkRow: { top: 0.762 },
  moneyOrderRow: { top: 0.796 },
  bank: { left: 0.31, width: 0.2 },
  number: { left: 0.52, width: 0.24 },
  instrumentDate: { left: 0.77, width: 0.22 },
  officer: { left: 0.15, top: 0.9, width: 0.7 },
} as const;

export interface PrintLine {
  nature: string;
  cents: number;
  descriptions: string[];
}

export interface PlacedRow {
  kind: "nature" | "description";
  text: string;
  /** Only on the nature row. */
  cents?: number;
}

/** Each nature takes a row, and each description line takes the row under it. The form has 8 rows. */
export function placeRows(lines: PrintLine[]): { rows: PlacedRow[]; overflow: boolean } {
  const rows: PlacedRow[] = [];
  for (const l of lines) {
    rows.push({ kind: "nature", text: l.nature, cents: l.cents });
    for (const d of l.descriptions) rows.push({ kind: "description", text: d });
  }
  return { rows: rows.slice(0, ROW_COUNT), overflow: rows.length > ROW_COUNT };
}

/** Break text into lines of at most `max` characters at word boundaries. */
export function wrapWords(text: string, max: number): string[] {
  const out: string[] = [];
  let line = "";
  for (const word of text.split(/\s+/).filter(Boolean)) {
    if (line && (line + " " + word).length > max) {
      out.push(line);
      line = word;
    } else line = line ? `${line} ${word}` : word;
  }
  if (line) out.push(line);
  return out;
}
