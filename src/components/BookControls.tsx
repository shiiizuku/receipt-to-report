"use client";

import { useState, useTransition } from "react";
import { activateBookAction, registerBookAction } from "@/app/actions/ledger";

export function ActivateButton({ bookId, label }: { bookId: number; label: string }) {
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  return (
    <div>
      <button
        className="btn"
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await activateBookAction(bookId);
            if (!res.ok) setError(res.error);
          })
        }
      >
        {pending ? "Saving…" : label}
      </button>
      {error ? (
        <p className="fld-msg bad" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

export function RegisterBook({
  officers,
  lockedOfficerId,
  suggestedFrom,
  today,
}: {
  officers: Array<{ id: number; name: string }>;
  lockedOfficerId: number | null;
  suggestedFrom: number;
  today: string;
}) {
  const [open, setOpen] = useState(false);
  const [from, setFrom] = useState(String(suggestedFrom));
  const [to, setTo] = useState(String(suggestedFrom + 49));
  const [date, setDate] = useState(today);
  const [officerId, setOfficerId] = useState(lockedOfficerId ?? officers[0].id);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const f = parseInt(from, 10);
  const t = parseInt(to, 10);
  const count = f && t && t >= f ? t - f + 1 : null;
  const hint = !f || !t ? "Enter the first and last control number." : t < f ? "The last number must come after the first." : `${count} control numbers.`;

  if (!open) {
    return (
      <button className="btn" type="button" onClick={() => setOpen(true)} aria-expanded="false" aria-controls="register-book">
        Register new book
      </button>
    );
  }
  return (
    <div id="register-book" className="drawer" style={{ gridColumn: "1 / -1" }}>
      <div>
        <p className="eyebrow">Accountable Form No. 51-C</p>
        <h3>Register a book</h3>
      </div>
      <div className="form" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))" }}>
        <div>
          <label htmlFor="b-from">First control number</label>
          <input id="b-from" className="amt num" inputMode="numeric" value={from} onChange={(e) => setFrom(e.target.value)} />
        </div>
        <div>
          <label htmlFor="b-to">Last control number</label>
          <input id="b-to" className="amt num" inputMode="numeric" value={to} onChange={(e) => setTo(e.target.value)} />
        </div>
        <div>
          <label htmlFor="b-count">Receipts in book</label>
          <input id="b-count" readOnly className="amt" value={count ?? ""} />
        </div>
        <div>
          <label htmlFor="b-date">Date received</label>
          <input id="b-date" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        <div>
          <label htmlFor="b-who">Issued to</label>
          <div className="sel">
            <select id="b-who" value={officerId} disabled={lockedOfficerId !== null} onChange={(e) => setOfficerId(Number(e.target.value))}>
              {officers.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>
      <p className={`fld-msg ${error ? "bad" : ""}`} role="status" aria-live="polite">
        {error ?? hint}
      </p>
      <div className="actions">
        <button className="btn out" type="button" onClick={() => { setOpen(false); setError(null); }}>
          Cancel
        </button>
        <button
          className="btn"
          type="button"
          disabled={pending || !count}
          onClick={() =>
            start(async () => {
              const res = await registerBookAction({ fromNo: f, toNo: t, officerId, receivedOn: date });
              if (res.ok) {
                setOpen(false);
                setError(null);
              } else setError(res.error);
            })
          }
        >
          {pending ? "Registering…" : "Register book"}
        </button>
      </div>
    </div>
  );
}
