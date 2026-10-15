"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { cancelDepositAction, recordDepositAction, validateDepositAction } from "@/app/actions/ledger";
import { fmtShort } from "@/lib/dates";
import { peso } from "@/lib/money";

export interface Waiting {
  id: number;
  controlNo: number;
  date: string;
  payor: string;
  modes: string[];
  cents: number;
}

export function DepositBoard({
  officers, officerId, lockedOfficerId, waiting, suggestedSlip, today, bank,
}: {
  officers: Array<{ id: number; name: string }>;
  officerId: number;
  lockedOfficerId: number | null;
  waiting: Waiting[];
  suggestedSlip: string;
  today: string;
  bank: string;
}) {
  const router = useRouter();
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [slip, setSlip] = useState(suggestedSlip);
  const [date, setDate] = useState(today);
  const [msg, setMsg] = useState<{ kind: "ok" | "bad"; text: string } | null>(null);
  const [pending, start] = useTransition();

  const chosen = useMemo(() => waiting.filter((w) => picked.has(w.id)), [waiting, picked]);
  const isCash = (w: Waiting) => w.modes.length === 1 && w.modes[0] === "Cash";
  const cash = chosen.filter(isCash).reduce((a, w) => a + w.cents, 0);
  const total = chosen.reduce((a, w) => a + w.cents, 0);

  const toggle = (id: number, on: boolean) =>
    setPicked((s) => {
      const n = new Set(s);
      if (on) n.add(id);
      else n.delete(id);
      return n;
    });

  return (
    <div className="grid2" style={{ gridTemplateColumns: "minmax(0,1.5fr) minmax(0,1fr)" }}>
      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: 12, flexWrap: "wrap", marginBottom: 10 }}>
          <h3>Awaiting deposit</h3>
          <div style={{ minWidth: 220 }}>
            <label htmlFor="dp-off">Collecting officer</label>
            <div className="sel">
              <select
                id="dp-off"
                value={officerId}
                disabled={lockedOfficerId !== null}
                style={{ height: 44 }}
                onChange={(e) => router.push(`/deposits?officer=${e.target.value}`)}
              >
                {officers.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
        <div className="scroll">
          <table className="mini" style={{ minWidth: 520 }}>
            <thead>
              <tr>
                <th style={{ width: 44 }}>
                  <span style={{ position: "absolute", left: -9999 }}>Select</span>
                </th>
                <th>Date</th>
                <th>OR No.</th>
                <th>Payor</th>
                <th>Mode</th>
                <th style={{ textAlign: "right" }}>Amount</th>
              </tr>
            </thead>
            <tbody>
              {waiting.length === 0 ? (
                <tr>
                  <td colSpan={6} className="note" style={{ padding: 18 }}>
                    Nothing is waiting for deposit.
                  </td>
                </tr>
              ) : null}
              {waiting.map((w) => (
                <tr key={w.id}>
                  <td>
                    <input type="checkbox" aria-label={`Select OR ${w.controlNo}`} checked={picked.has(w.id)} onChange={(e) => toggle(w.id, e.target.checked)} style={{ width: 22, height: 22, accentColor: "var(--accent)" }} />
                  </td>
                  <td>{fmtShort(w.date)}</td>
                  <td className="num">{w.controlNo}</td>
                  <td>{w.payor}</td>
                  <td>{w.modes.join(" + ")}</td>
                  <td className="amt num">{peso(w.cents)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="actions" style={{ marginTop: 10, justifyContent: "flex-start" }}>
          <button className="link sm" type="button" onClick={() => setPicked(new Set(waiting.map((w) => w.id)))}>
            Select all
          </button>
          <button className="link sm" type="button" onClick={() => setPicked(new Set(waiting.filter(isCash).map((w) => w.id)))}>
            Select cash only
          </button>
          <button className="link sm" type="button" onClick={() => setPicked(new Set())}>
            Clear
          </button>
        </div>
      </div>

      <div className="card" style={{ alignSelf: "start" }}>
        <h3 style={{ marginBottom: 10 }}>Record deposit</h3>
        <div className="form" style={{ gridTemplateColumns: "minmax(0,1fr)" }}>
          <div>
            <label htmlFor="dp-date">Deposit date</label>
            <input id="dp-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div>
            <label htmlFor="dp-slip">Deposit slip no.</label>
            <input id="dp-slip" className="num" value={slip} onChange={(e) => setSlip(e.target.value)} />
          </div>
          <div>
            <label htmlFor="dp-bank">Depository bank</label>
            <input id="dp-bank" readOnly value={bank} />
          </div>
        </div>
        <div style={{ marginTop: 12 }}>
          <div className="kv"><span>Selected receipts</span><span>{chosen.length}</span></div>
          <div className="kv"><span>Cash</span><span>{peso(cash)}</span></div>
          <div className="kv"><span>Checks and money orders</span><span>{peso(total - cash)}</span></div>
          <div className="kv tot"><span>Deposit total</span><span>{peso(total)}</span></div>
        </div>
        <div role="status" aria-live="polite" style={{ marginTop: 8 }}>
          {msg ? <p className={`fld-msg ${msg.kind}`}>{msg.text}</p> : null}
        </div>
        <div className="actions">
          <button
            className="btn"
            type="button"
            disabled={!chosen.length || pending}
            onClick={() =>
              start(async () => {
                const res = await recordDepositAction({ officerId, receiptIds: chosen.map((c) => c.id), slipNo: slip, date });
                if (res.ok) {
                  setMsg({ kind: "ok", text: `Recorded slip ${res.slipNo} for ${peso(res.totalCents)}. Enter the bank message number once it is validated.` });
                  setPicked(new Set());
                  router.refresh();
                } else setMsg({ kind: "bad", text: res.error });
              })
            }
          >
            {pending ? "Recording…" : "Record deposit"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function ValidateCell({ id, slipNo, canAct }: { id: number; slipNo: string; canAct: boolean }) {
  const [v, setV] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (!canAct) return <span className="note">Waiting for the bank</span>;
  return (
    <div>
      <div style={{ display: "flex", gap: 6, alignItems: "center", flexWrap: "wrap" }}>
        <input aria-label={`Bank message number for slip ${slipNo}`} value={v} onChange={(e) => setV(e.target.value)} placeholder="Message no." style={{ height: 38, fontSize: 14, borderWidth: 1, minWidth: 130 }} />
        <button
          className="btn out"
          type="button"
          disabled={pending}
          style={{ minHeight: 38, paddingInline: 12 }}
          onClick={() =>
            start(async () => {
              const res = await validateDepositAction(id, v);
              if (!res.ok) setError(res.error);
            })
          }
        >
          Validate
        </button>
        <button
          className="link sm"
          type="button"
          disabled={pending}
          onClick={() => {
            if (!window.confirm(`Remove slip ${slipNo}? Its receipts go back to "not yet deposited".`)) return;
            start(async () => {
              const res = await cancelDepositAction(id);
              if (!res.ok) setError(res.error);
            });
          }}
        >
          Remove
        </button>
      </div>
      {error ? (
        <p className="fld-msg bad" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
