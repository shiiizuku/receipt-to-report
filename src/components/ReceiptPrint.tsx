"use client";

import { useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { DEFAULT_FORM_WIDTH_MM, FIELD, FORM_ASPECT, ROW_COUNT, placeRows, wrapWords, type PrintLine } from "@/lib/receipt-layout";
import { fmt } from "@/lib/money";
import { amountInWords } from "@/lib/words";

export interface PrintData {
  /** YYYY-MM-DD */
  date: string;
  agency: string;
  fund: string;
  payor: string;
  lines: PrintLine[];
  modes: string[];
  instruments: Array<{ kind: string; bank: string; number: string; date: string }>;
  officer: string;
}

type Paper = "a4" | "letter" | "form";
interface Settings {
  x: number;
  y: number;
  w: number;
  paper: Paper;
  guide: boolean;
}

const DEFAULTS: Settings = { x: 10, y: 10, w: DEFAULT_FORM_WIDTH_MM, paper: "a4", guide: true };
const KEY = "r2r.print.v1";
const PAPER_MM: Record<Exclude<Paper, "form">, [number, number]> = { a4: [210, 297], letter: [215.9, 279.4] };

function load(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    const s = JSON.parse(raw) as Partial<Settings>;
    const num = (v: unknown, d: number, lo: number, hi: number) => (typeof v === "number" && v >= lo && v <= hi ? v : d);
    return {
      x: num(s.x, DEFAULTS.x, -50, 200),
      y: num(s.y, DEFAULTS.y, -50, 300),
      w: num(s.w, DEFAULTS.w, 60, 200),
      paper: s.paper === "letter" || s.paper === "form" ? s.paper : "a4",
      guide: s.guide !== false,
    };
  } catch {
    return DEFAULTS;
  }
}

function longDate(iso: string): string {
  if (!iso) return "";
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
}

function shortDate(iso: string): string {
  if (!iso) return "";
  return new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" });
}

function pageSize(s: Settings): [number, number] {
  return s.paper === "form" ? [s.w, s.w * FORM_ASPECT] : PAPER_MM[s.paper];
}

/** Only the typed values, positioned on the form. The outline and row marks are a screen-only guide. */
function Sheet({ data, s, showGuide }: { data: PrintData; s: Settings; showGuide: boolean }) {
  const [pw, ph] = pageSize(s);
  const w = s.w;
  const h = w * FORM_ASPECT;
  const mm = (f: number) => `${(f * w).toFixed(2)}mm`;
  const mmV = (f: number) => `${(f * h).toFixed(2)}mm`;
  const fontMm = w * 0.034;
  const { rows } = placeRows(data.lines);
  const totalCents = data.lines.reduce((a, l) => a + l.cents, 0);
  const words = totalCents > 0 ? wrapWords(amountInWords(totalCents), 54) : [];
  const has = (m: string) => data.modes.includes(m);
  const inst = (kind: string) => data.instruments.find((i) => i.kind === kind);

  const pos = (left: number, top: number, width?: number, extra?: CSSProperties): CSSProperties => ({
    position: "absolute",
    left: mm(left),
    top: mmV(top),
    width: width !== undefined ? mm(width) : undefined,
    whiteSpace: "nowrap",
    overflow: "hidden",
    lineHeight: 1.15,
    ...extra,
  });

  return (
    <div className="print-sheet" style={{ width: `${pw}mm`, height: `${ph}mm` }}>
      <div style={{ position: "absolute", left: `${s.x}mm`, top: `${s.y}mm`, width: `${w}mm`, height: `${h}mm`, fontFamily: "Arial, Helvetica, sans-serif", fontSize: `${fontMm}mm`, color: "#000" }}>
        {showGuide ? (
          <div className="print-guide no-print" aria-hidden="true">
            {Array.from({ length: ROW_COUNT + 1 }, (_, i) => (
              <span key={i} className="guide-line" style={{ top: mmV(FIELD.firstRowTop + i * FIELD.rowPitch - 0.002) }} />
            ))}
            {[FIELD.date.top, FIELD.agency.top, FIELD.payor.top, FIELD.total.top, FIELD.words.top, FIELD.officer.top].map((t, i) => (
              <span key={`f${i}`} className="guide-line faint" style={{ top: mmV(t - 0.004) }} />
            ))}
            <span className="guide-box" />
          </div>
        ) : null}

        <div style={pos(FIELD.date.left, FIELD.date.top, FIELD.date.width)}>{longDate(data.date)}</div>
        <div style={pos(FIELD.agency.left, FIELD.agency.top, FIELD.agency.width, { fontSize: `${fontMm * 0.86}mm` })}>{data.agency}</div>
        <div style={pos(FIELD.fund.left, FIELD.fund.top, FIELD.fund.width)}>{data.fund}</div>
        <div style={pos(FIELD.payor.left, FIELD.payor.top, FIELD.payor.width)}>{data.payor}</div>

        {rows.map((r, i) => {
          const top = FIELD.firstRowTop + i * FIELD.rowPitch;
          return (
            <div key={i}>
              <div style={pos(FIELD.nature.left, top, FIELD.nature.width, { fontSize: `${fontMm * (r.kind === "nature" ? 0.9 : 0.8)}mm`, paddingLeft: r.kind === "description" ? "1.5mm" : undefined })}>{r.text}</div>
              {r.cents !== undefined ? <div style={pos(FIELD.amount.left, top, FIELD.amount.width, { textAlign: "right" })}>{fmt(r.cents)}</div> : null}
            </div>
          );
        })}

        {totalCents > 0 ? <div style={pos(FIELD.total.left, FIELD.total.top, FIELD.total.width, { textAlign: "right", fontWeight: 700 })}>{fmt(totalCents)}</div> : null}

        {words.map((line, i) => (
          <div key={i} style={pos(FIELD.words.left, FIELD.words.top + i * FIELD.words.pitch, FIELD.words.width, { fontSize: `${fontMm * 0.92}mm` })}>
            {line}
          </div>
        ))}

        {has("Cash") ? <div style={pos(FIELD.modeCash.left, FIELD.modeCash.top, undefined, { fontWeight: 700 })}>X</div> : null}
        {has("Check") ? <div style={pos(FIELD.modeCheck.left, FIELD.modeCheck.top, undefined, { fontWeight: 700 })}>X</div> : null}
        {has("Money Order") ? <div style={pos(FIELD.modeMoneyOrder.left, FIELD.modeMoneyOrder.top, undefined, { fontWeight: 700 })}>X</div> : null}

        {(
          [
            ["Check", FIELD.checkRow.top],
            ["Money Order", FIELD.moneyOrderRow.top],
          ] as const
        ).map(([kind, top]) => {
          const i = inst(kind);
          if (!i || !has(kind)) return null;
          return (
            <div key={kind}>
              <div style={pos(FIELD.bank.left, top, FIELD.bank.width, { fontSize: `${fontMm * 0.8}mm` })}>{i.bank}</div>
              <div style={pos(FIELD.number.left, top, FIELD.number.width, { fontSize: `${fontMm * 0.8}mm` })}>{i.number}</div>
              <div style={pos(FIELD.instrumentDate.left, top, FIELD.instrumentDate.width, { fontSize: `${fontMm * 0.8}mm` })}>{shortDate(i.date)}</div>
            </div>
          );
        })}

        <div style={pos(FIELD.officer.left, FIELD.officer.top, FIELD.officer.width, { textAlign: "center", fontWeight: 700, fontSize: `${fontMm * 0.9}mm` })}>{data.officer}</div>
      </div>
    </div>
  );
}

export function ReceiptPrint({ data, className = "btn out", label = "Print preview" }: { data: PrintData | null; className?: string; label?: string }) {
  const [open, setOpen] = useState(false);
  const [s, setS] = useState<Settings>(DEFAULTS);
  const [scale, setScale] = useState(1);
  const trigger = useRef<HTMLButtonElement>(null);
  const printBtn = useRef<HTMLButtonElement>(null);
  const area = useRef<HTMLDivElement>(null);
  const titleId = useId();

  useEffect(() => setS(load()), []);
  const update = (patch: Partial<Settings>) =>
    setS((cur) => {
      const next = { ...cur, ...patch };
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch {
        /* storage can be blocked */
      }
      return next;
    });

  const close = () => {
    setOpen(false);
    trigger.current?.focus();
  };

  useEffect(() => {
    if (!open) return;
    printBtn.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  const [pw, ph] = pageSize(s);
  useLayoutEffect(() => {
    if (!open || !area.current) return;
    const el = area.current;
    const fit = () => setScale(Math.min(1.4, Math.max(0.2, (el.clientWidth - 24) / (pw * 3.7795))));
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(el);
    return () => ro.disconnect();
  }, [open, pw]);

  const rows = useMemo(() => (data ? placeRows(data.lines) : { rows: [], overflow: false }), [data]);
  const total = data ? data.lines.reduce((a, l) => a + l.cents, 0) : 0;

  return (
    <>
      <button ref={trigger} type="button" className={className} disabled={!data} onClick={() => setOpen(true)} aria-haspopup="dialog">
        {label}
      </button>
      {open && data ? (
        <>
          <div className="print-overlay no-print" role="dialog" aria-modal="true" aria-labelledby={titleId}>
            <div className="print-panel">
              <div className="print-head">
                <div>
                  <h3 id={titleId}>Print preview</h3>
                  <p className="note">Only the values you typed are printed, placed on the official form. The grey outline is a guide and does not print.</p>
                </div>
                <div className="actions">
                  <button className="btn out" type="button" onClick={close}>
                    Close
                  </button>
                  <button ref={printBtn} className="btn" type="button" onClick={() => window.print()}>
                    Print
                  </button>
                </div>
              </div>

              {rows.overflow ? (
                <p className="alert" role="alert">
                  This receipt has more lines than the form has rows ({ROW_COUNT}). Only the first {ROW_COUNT} rows will print. Remove a description or a line, or issue a second receipt.
                </p>
              ) : null}
              {total === 0 ? <p className="note">No amount entered yet, so the amount and the words are blank.</p> : null}

              <div className="print-controls">
                <div>
                  <label htmlFor="pp-paper">Paper</label>
                  <div className="sel">
                    <select id="pp-paper" value={s.paper} onChange={(e) => update({ paper: e.target.value as Paper })}>
                      <option value="a4">A4 (210 × 297 mm)</option>
                      <option value="letter">Letter (8.5 × 11 in)</option>
                      <option value="form">Form size (feed the booklet)</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label htmlFor="pp-w">Form width (mm)</label>
                  <input id="pp-w" type="number" step="0.5" min="60" max="200" value={s.w} onChange={(e) => update({ w: Number(e.target.value) || DEFAULTS.w })} />
                </div>
                <div>
                  <label htmlFor="pp-x">Move right (mm)</label>
                  <input id="pp-x" type="number" step="0.5" value={s.x} onChange={(e) => update({ x: Number(e.target.value) || 0 })} />
                </div>
                <div>
                  <label htmlFor="pp-y">Move down (mm)</label>
                  <input id="pp-y" type="number" step="0.5" value={s.y} onChange={(e) => update({ y: Number(e.target.value) || 0 })} />
                </div>
              </div>
              <div className="print-tools">
                <label className="check-row">
                  <input type="checkbox" checked={s.guide} onChange={(e) => update({ guide: e.target.checked })} />
                  Show the form outline in the preview
                </label>
                <button className="link sm" type="button" onClick={() => update({ ...DEFAULTS, paper: s.paper })}>
                  Reset position
                </button>
              </div>
              <p className="help">
                To line it up with your booklet: print once on plain paper, hold it against the form, then adjust the form width and the two offsets. Your settings are remembered on this computer.
              </p>

              <div className="print-area" ref={area}>
                <div style={{ width: `${pw * scale * 3.7795}px`, height: `${ph * scale * 3.7795}px` }}>
                  <div className="print-scale" style={{ transform: `scale(${scale})` }}>
                    <Sheet data={data} s={s} showGuide={s.guide} />
                  </div>
                </div>
              </div>
            </div>
          </div>
          {createPortal(
            <div className="print-portal">
              <style>{s.paper === "form" ? `@page{size:${s.w}mm ${(s.w * FORM_ASPECT).toFixed(1)}mm;margin:0}` : `@page{size:${s.paper === "a4" ? "A4" : "letter"} portrait;margin:0}`}</style>
              <Sheet data={data} s={s} showGuide={false} />
            </div>,
            document.body,
          )}
        </>
      ) : null}
    </>
  );
}
