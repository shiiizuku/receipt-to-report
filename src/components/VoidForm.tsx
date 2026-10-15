"use client";

import { useState, useTransition } from "react";
import { voidReceiptAction } from "@/app/actions/ledger";

export function VoidForm({ id, controlNo }: { id: number; controlNo: number }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  if (!open) {
    return (
      <button className="btn danger" type="button" onClick={() => setOpen(true)} aria-expanded="false">
        Void receipt
      </button>
    );
  }
  return (
    <div className="drawer" style={{ borderColor: "var(--alert-fg)" }}>
      <div>
        <p className="eyebrow" style={{ color: "var(--alert-fg)" }}>
          OR No. {controlNo}
        </p>
        <h3>Void this receipt</h3>
      </div>
      <p className="note">The control number stays used, the amount leaves every report, and the reason is kept in the audit trail. A voided receipt cannot be restored.</p>
      <div>
        <label htmlFor="void-reason">Reason</label>
        <input id="void-reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Wrong payor name written" autoFocus />
      </div>
      {error ? (
        <p className="alert" role="alert">
          {error}
        </p>
      ) : null}
      <div className="actions">
        <button className="btn out" type="button" onClick={() => { setOpen(false); setError(null); }}>
          Keep receipt
        </button>
        <button
          className="btn danger"
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const res = await voidReceiptAction(id, reason);
              if (res.ok) setOpen(false);
              else setError(res.error);
            })
          }
        >
          {pending ? "Voiding…" : "Void receipt"}
        </button>
      </div>
    </div>
  );
}
