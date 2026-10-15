"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { saveOfficerTitleAction, saveSignatoriesAction } from "@/app/actions/ledger";

export interface FilterState {
  type: "rcd" | "mrdc" | "sdc" | "rev";
  month: string; // YYYY-MM
  half: "1" | "2";
  fund: number;
  officer: number;
  reportNo: string;
}

const TYPES: Array<[FilterState["type"], string]> = [
  ["rcd", "RCD"],
  ["mrdc", "Monthly RCD"],
  ["sdc", "Deposited collections"],
  ["rev", "Revenue"],
];

export function ReportFilters({
  state, officers, funds, lockedOfficerId, exportBase,
}: {
  state: FilterState;
  officers: Array<{ id: number; name: string }>;
  funds: Array<{ id: number; name: string }>;
  lockedOfficerId: number | null;
  exportBase: string;
}) {
  const router = useRouter();
  const [no, setNo] = useState(state.reportNo);
  const go = (patch: Partial<FilterState>) => {
    const s = { ...state, reportNo: no, ...patch };
    const q = new URLSearchParams({ type: s.type, month: s.month, half: s.half, fund: String(s.fund), officer: String(s.officer) });
    if (s.reportNo) q.set("no", s.reportNo);
    router.push(`/reports?${q.toString()}`);
  };
  const showRcd = state.type === "rcd";
  const showOfficer = state.type === "rcd" || state.type === "mrdc";
  return (
    <div className="card" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <div className="togg" role="group" aria-label="Report">
        {TYPES.map(([k, label]) => (
          <button key={k} type="button" aria-pressed={state.type === k} onClick={() => go({ type: k })}>
            {label}
          </button>
        ))}
      </div>
      <div className="filters">
        <div>
          <label htmlFor="rp-month">Month</label>
          <input id="rp-month" type="month" value={state.month} onChange={(e) => e.target.value && go({ month: e.target.value })} />
        </div>
        {showRcd ? (
          <>
            <div>
              <label htmlFor="rp-half">Period</label>
              <div className="sel">
                <select id="rp-half" value={state.half} onChange={(e) => go({ half: e.target.value as "1" | "2" })}>
                  <option value="1">1st to 15th</option>
                  <option value="2">16th to month end</option>
                </select>
              </div>
            </div>
            <div>
              <label htmlFor="rp-fund">Fund</label>
              <div className="sel">
                <select id="rp-fund" value={state.fund} onChange={(e) => go({ fund: Number(e.target.value) })}>
                  {funds.map((f) => (
                    <option key={f.id} value={f.id}>
                      {f.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div>
              <label htmlFor="rp-no">Report no.</label>
              <input id="rp-no" value={no} onChange={(e) => setNo(e.target.value)} onBlur={() => no !== state.reportNo && go({ reportNo: no })} onKeyDown={(e) => e.key === "Enter" && go({ reportNo: no })} placeholder="e.g. 2026-09" />
            </div>
          </>
        ) : null}
        {showOfficer ? (
          <div>
            <label htmlFor="rp-off">Collecting officer</label>
            <div className="sel">
              <select id="rp-off" value={state.officer} disabled={lockedOfficerId !== null} onChange={(e) => go({ officer: Number(e.target.value) })}>
                {officers.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        ) : null}
        <div style={{ display: "flex", gap: 10, flex: "0 0 auto", alignItems: "flex-end" }}>
          <a className="btn out" href={`${exportBase}&format=xlsx`} download>
            Export Excel
          </a>
          <a className="btn" href={`${exportBase}&format=pdf`} download>
            Export PDF
          </a>
        </div>
      </div>
    </div>
  );
}

export function SignatoryEditor({
  signatories, officersWithoutTitle,
}: {
  signatories: Array<{ key: string; label: string; name: string; title: string }>;
  officersWithoutTitle: Array<{ id: number; name: string; title: string | null }>;
}) {
  const [rows, setRows] = useState(signatories);
  const [titles, setTitles] = useState(Object.fromEntries(officersWithoutTitle.map((o) => [o.id, o.title ?? ""])));
  const [msg, setMsg] = useState<{ kind: "ok" | "bad"; text: string } | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();
  const set = (i: number, patch: Partial<(typeof rows)[number]>) => setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  return (
    <details className="card">
      <summary className="link sm">Edit the names printed on this report</summary>
      <div style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 12 }}>
        {rows.map((r, i) => (
          <div key={r.key} className="form" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))" }}>
            <div>
              <label htmlFor={`sg-n-${r.key}`}>{r.label} name</label>
              <input id={`sg-n-${r.key}`} value={r.name} onChange={(e) => set(i, { name: e.target.value })} />
            </div>
            <div>
              <label htmlFor={`sg-t-${r.key}`}>Title</label>
              <input id={`sg-t-${r.key}`} value={r.title} onChange={(e) => set(i, { title: e.target.value })} />
            </div>
          </div>
        ))}
        {officersWithoutTitle.map((o) => (
          <div key={o.id} className="form" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))" }}>
            <div>
              <label htmlFor={`ot-${o.id}`}>Title of {o.name}</label>
              <input id={`ot-${o.id}`} value={titles[o.id] ?? ""} onChange={(e) => setTitles((t) => ({ ...t, [o.id]: e.target.value }))} />
            </div>
          </div>
        ))}
        <div role="status" aria-live="polite">{msg ? <p className={`fld-msg ${msg.kind}`}>{msg.text}</p> : null}</div>
        <div className="actions">
          <button
            className="btn"
            type="button"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const a = rows.length ? await saveSignatoriesAction(rows.map(({ key, name, title }) => ({ key, name, title }))) : { ok: true as const };
                if (!a.ok) return setMsg({ kind: "bad", text: a.error });
                for (const o of officersWithoutTitle) {
                  const b = await saveOfficerTitleAction(o.id, titles[o.id] ?? "");
                  if (!b.ok) return setMsg({ kind: "bad", text: b.error });
                }
                setMsg({ kind: "ok", text: "Saved. The report now shows these names." });
                router.refresh();
              })
            }
          >
            {pending ? "Saving…" : "Save names"}
          </button>
        </div>
      </div>
    </details>
  );
}
