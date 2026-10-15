import Link from "next/link";
import { notFound } from "next/navigation";
import { ReceiptPrint } from "@/components/ReceiptPrint";
import { VoidForm } from "@/components/VoidForm";
import { AGENCY } from "@/lib/constants";
import { fmtDate } from "@/lib/dates";
import { peso } from "@/lib/money";
import { canActFor, requireUser } from "@/lib/session";
import { amountInWords } from "@/lib/words";
import { getReceipt } from "@/services/receipts";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return { title: `Receipt ${id}` };
}

export default async function ReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  const data = await getReceipt(Number(id));
  if (!data) notFound();
  const { r, lines } = data;
  const total = lines.reduce((a, l) => a + l.cents, 0);
  const voided = r.status === "voided";
  const rule = "1.5px solid var(--ink2)";
  const canVoid = !voided && !r.depositId && canActFor(user, r.officerId);
  const canEdit = canActFor(user, r.officerId);

  return (
    <div className="scr">
      <div className="head">
        <div>
          <p className="eyebrow">
            <Link href="/receipts" style={{ color: "inherit" }}>
              Receipts
            </Link>{" "}
            · OR No. {r.controlNo}
          </p>
          <div className="t">{r.payor}</div>
          <p className="sub">
            {fmtDate(r.receiptDate)} · {data.fundName} · {data.officerName}
          </p>
        </div>
        <span style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {voided ? <span className="pill void">Voided</span> : r.depositId ? <span className="pill done">Deposited · {data.depositSlip}</span> : <span className="pill move">Posted</span>}
        </span>
      </div>

      {voided ? (
        <div className="alert" role="status">
          Voided {r.voidedAt ? fmtDate(r.voidedAt.toISOString().slice(0, 10)) : ""}. Reason: {r.voidReason}
        </div>
      ) : null}

      <div className="grid2">
        <div className="paper" style={{ padding: 0, gap: 0, borderRadius: 6, overflow: "hidden", border: rule, opacity: voided ? 0.7 : 1 }}>
          <div className="note" style={{ display: "flex", justifyContent: "space-between", padding: "8px 12px" }}>
            <span>Accountable Form No. 51-C · Revised January, 1992</span>
            <b style={{ color: "var(--ink)" }}>(ORIGINAL)</b>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "110px minmax(0,1fr)", borderTop: rule }}>
            <div style={{ borderRight: rule, display: "grid", placeItems: "center", padding: 10, color: "var(--ink3)", fontSize: 11 }}>[Republic seal]</div>
            <div>
              <div style={{ textAlign: "center", fontWeight: 700, padding: 8, borderBottom: rule, lineHeight: 1.25 }}>
                Official Receipt
                <br />
                of the
                <br />
                Republic of the Philippines
              </div>
              <div style={{ padding: "8px 12px", borderBottom: rule, display: "flex", gap: 10, alignItems: "center" }}>
                <span style={{ fontFamily: "var(--display)", fontSize: 22 }}>
                  N<sup>o</sup>
                </span>
                <span className="num" style={{ fontSize: 28, letterSpacing: ".08em" }}>
                  {r.controlNo}
                </span>
              </div>
              <div style={{ padding: "8px 12px" }}>Date: {fmtDate(r.receiptDate)}</div>
            </div>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) minmax(140px,.45fr)", borderTop: rule }}>
            <div style={{ padding: "8px 12px", borderRight: rule }}>
              <span className="lbl" style={{ marginBottom: 2 }}>
                Agency
              </span>
              <b>{AGENCY}</b>
            </div>
            <div style={{ padding: "8px 12px" }}>
              <span className="lbl" style={{ marginBottom: 2 }}>
                Fund
              </span>
              <b>{data.fundName}</b>
            </div>
          </div>
          <div style={{ padding: "8px 12px", borderTop: rule }}>
            <span className="lbl" style={{ marginBottom: 2 }}>
              Payor
            </span>
            <b>{r.payor}</b>
          </div>
          <div className="scroll" style={{ borderTop: rule }}>
            <table className="mini" style={{ minWidth: 420 }}>
              <thead>
                <tr>
                  <th>Nature of collection</th>
                  <th style={{ textAlign: "right" }}>Amount (₱)</th>
                </tr>
              </thead>
              <tbody>
                {lines.map((l) => (
                  <tr key={l.lineNo}>
                    <td>
                      <b>{l.nature}</b>
                      {l.descriptions.map((d) => (
                        <div key={d}>{d}</div>
                      ))}
                    </td>
                    <td className="amt num">{peso(l.cents).replace("₱ ", "")}</td>
                  </tr>
                ))}
                <tr>
                  <td style={{ textAlign: "right", fontWeight: 700, borderTop: rule }}>TOTAL ₱</td>
                  <td className="amt num" style={{ borderTop: rule, fontSize: 18 }}>
                    {peso(total).replace("₱ ", "")}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <div style={{ padding: "8px 12px", borderTop: rule }}>
            <span className="lbl" style={{ marginBottom: 2 }}>
              Amount in words
            </span>
            <p style={{ fontFamily: "var(--display)", fontSize: 20 }}>{amountInWords(total)}</p>
          </div>
          <div style={{ padding: "8px 12px", borderTop: rule }}>
            <span className="lbl" style={{ marginBottom: 2 }}>
              Paid by
            </span>
            {r.modes.join(" + ")}
            {r.instruments?.map((i) => (
              <div className="note" key={`${i.kind}${i.number}`}>
                {i.kind}: {i.bank || "—"} · No. {i.number || "—"} · {i.date ? fmtDate(i.date) : "—"}
              </div>
            ))}
          </div>
          <div style={{ padding: 12, borderTop: rule }}>
            <p>Received the amount stated above.</p>
            <div style={{ margin: "22px auto 0", width: "min(340px,100%)", textAlign: "center" }}>
              <b>{data.officerName}</b>
              <div style={{ borderTop: "1px dotted var(--ink3)", paddingTop: 4, marginTop: 6 }}>Collecting Officer</div>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          <div className="card">
            <span className="lbl">For the reports</span>
            <div className="kv">
              <span>Division</span>
              <span>{r.division ?? "—"}</span>
            </div>
            <div className="kv">
              <span>Order of payment no.</span>
              <span className="num">{r.opNo ?? "—"}</span>
            </div>
            <div className="kv">
              <span>Deposit slip</span>
              <span className="num">{data.depositSlip ?? "Not yet deposited"}</span>
            </div>
          </div>
          {canEdit ? (
            <div className="card">
              <span className="lbl">Correct</span>
              <p className="note" style={{ marginBottom: 10 }}>
                {voided ? "Fix what was written on this voided receipt, or why it was voided. It stays out of every total. " : "Fix the payor, natures, amounts, payment, division or the OR number."}{r.depositId ? " Amounts, payment mode, fund and date are locked while it is on a deposit." : ""} Every change is recorded in the audit trail.
              </p>
              <Link className="btn out" href={`/receipts/${r.id}/edit`}>
                Edit receipt
              </Link>
            </div>
          ) : null}
          {!voided ? (
            <div className="card">
              <span className="lbl">Print</span>
              <p className="note" style={{ marginBottom: 10 }}>Prints only the values onto your pre-printed form, so the control number and the blank form are not reprinted.</p>
              <ReceiptPrint
                label="Print receipt"
                className="btn"
                data={{
                  date: r.receiptDate,
                  agency: AGENCY,
                  fund: data.fundName,
                  payor: r.payor,
                  lines: lines.map((l) => ({ nature: l.nature, cents: l.cents, descriptions: l.descriptions })),
                  modes: r.modes,
                  instruments: r.instruments ?? [],
                  officer: data.officerName,
                }}
              />
            </div>
          ) : null}
          {canVoid ? <VoidForm id={r.id} controlNo={r.controlNo} /> : null}
          {!voided && r.depositId ? <p className="note">This receipt is on a deposit slip, so it cannot be voided. Remove it from the deposit first.</p> : null}
        </div>
      </div>
    </div>
  );
}
