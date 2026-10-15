"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { addDivisionAction, postReceiptAction, updateReceiptAction } from "@/app/actions/ledger";
import { ReceiptPrint, type PrintData } from "./ReceiptPrint";
import { AGENCY } from "@/lib/constants";
import { peso, toCents } from "@/lib/money";
import { amountInWords } from "@/lib/words";

export interface ActiveBook {
  bookNo: number;
  fromNo: number;
  toNo: number;
  nextNo: number;
  left: number;
}

interface Props {
  officers: Array<{ id: number; name: string }>;
  funds: Array<{ id: number; name: string }>;
  natures: Array<{ id: number; name: string }>;
  divisions: Array<{ code: string; rccCode: string | null; noOpNumber: boolean }>;
  descriptions: string[];
  payors: string[];
  activeBooks: Record<number, ActiveBook | null>;
  lockedOfficerId: number | null;
  today: string;
  /** Every registered book of each officer, to say which book a typed OR number falls in. */
  officerBooks: Record<number, Array<{ bookNo: number; fromNo: number; toNo: number }>>;
  /** Present when correcting a posted receipt. */
  edit?: {
    id: number;
    controlNo: number;
    depositSlip: string | null;
    /** Set when the receipt is voided; it can still be corrected. */
    voidReason?: string | null;
    initial: {
      date: string;
      fundId: number;
      payor: string;
      officerId: number;
      division: string;
      opNo: string;
      modes: string[];
      instruments: Array<{ kind: string; bank: string; number: string; date: string }>;
      lines: Array<{ natureId: number; amount: string; descriptions: string[] }>;
    };
  };
}

interface Line {
  key: number;
  natureId: string;
  amount: string;
  descs: string[];
}

let keySeed = 1;
const newLine = (): Line => ({ key: keySeed++, natureId: "", amount: "", descs: [] });

const blankInfo = { bank: "", number: "", date: "" };

export function ReceiptForm(p: Props) {
  const init = p.edit?.initial;
  const router = useRouter();
  const [officerId, setOfficerId] = useState<number>(init?.officerId ?? p.lockedOfficerId ?? p.officers[0].id);
  const [date, setDate] = useState(init?.date ?? p.today);
  const [fundId, setFundId] = useState<number>(init?.fundId ?? p.funds[0].id);
  const [payor, setPayor] = useState(init?.payor ?? "");
  const [lines, setLines] = useState<Line[]>(() =>
    init ? init.lines.map((l) => ({ key: keySeed++, natureId: String(l.natureId), amount: l.amount, descs: l.descriptions })) : [newLine()],
  );
  const [cash, setCash] = useState(init ? init.modes.includes("Cash") : true);
  const [check, setCheck] = useState(init ? init.modes.includes("Check") : false);
  const [mo, setMo] = useState(init ? init.modes.includes("Money Order") : false);
  const [checkInfo, setCheckInfo] = useState(init?.instruments.find((i) => i.kind === "Check") ?? blankInfo);
  const [moInfo, setMoInfo] = useState(init?.instruments.find((i) => i.kind === "Money Order") ?? blankInfo);
  const [divs, setDivs] = useState(p.divisions);
  const [division, setDivision] = useState(init?.division ?? p.divisions[0]?.code ?? "");
  const [addingDiv, setAddingDiv] = useState(false);
  const [newDiv, setNewDiv] = useState({ code: "", rcc: "", noOp: false });
  const [divError, setDivError] = useState<string | null>(null);
  const [divPending, startDiv] = useTransition();
  const [opNo, setOpNo] = useState(init?.opNo ?? "");
  const [numberText, setNumberText] = useState(p.edit ? String(p.edit.controlNo) : "");
  const [numberTouched, setNumberTouched] = useState(false);
  const locked = !!p.edit?.depositSlip;
  const isVoided = p.edit?.voidReason !== undefined && p.edit?.voidReason !== null;
  const [voidReason, setVoidReason] = useState(p.edit?.voidReason ?? "");
  const [message, setMessage] = useState<{ kind: "ok" | "bad"; text: string; id?: number } | null>(null);
  const [pending, start] = useTransition();

  const book = p.activeBooks[officerId] ?? null;
  const suggested = book && book.nextNo <= book.toNo ? book.nextNo : null;
  // New receipts follow the suggested number until the person types another; edits start from the receipt's own.
  const shownNo = p.edit || numberTouched ? numberText : suggested !== null ? String(suggested) : "";
  const typedNo = /^\d+$/.test(shownNo) ? Number(shownNo) : null;
  const holder = typedNo === null ? null : (p.officerBooks[officerId] ?? []).find((b) => typedNo >= b.fromNo && typedNo <= b.toNo) ?? null;
  const canPost = holder !== null;
  const totalCents = useMemo(() => lines.reduce((a, l) => a + toCents(l.amount), 0), [lines]);
  const noOp = divs.find((d) => d.code === division)?.noOpNumber ?? false;

  // Only what has been typed. Account codes, the order of payment and the division are not on the form.
  const printData: PrintData | null = useMemo(() => {
    const filled = lines
      .filter((l) => l.natureId && toCents(l.amount) > 0)
      .map((l) => ({
        nature: p.natures.find((n) => String(n.id) === l.natureId)?.name ?? "",
        cents: toCents(l.amount),
        descriptions: l.descs.map((d) => d.trim()).filter(Boolean),
      }));
    if (!payor.trim() && filled.length === 0) return null;
    const modes = [cash && "Cash", check && "Check", mo && "Money Order"].filter(Boolean) as string[];
    return {
      date,
      agency: AGENCY,
      fund: p.funds.find((f) => f.id === fundId)?.name ?? "",
      payor: payor.trim(),
      lines: filled,
      modes,
      instruments: [check ? { kind: "Check", ...checkInfo } : null, mo ? { kind: "Money Order", ...moInfo } : null].filter(Boolean) as PrintData["instruments"],
      officer: p.officers.find((o) => o.id === officerId)?.name ?? "",
    };
  }, [lines, payor, date, fundId, cash, check, mo, checkInfo, moInfo, officerId, p.natures, p.funds, p.officers]);

  const setLine = (key: number, patch: Partial<Line>) => setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)));

  function reset() {
    setNumberTouched(false);
    setNumberText("");
    setPayor("");
    setLines([newLine()]);
    setCash(true);
    setCheck(false);
    setMo(false);
    setCheckInfo({ bank: "", number: "", date: "" });
    setMoInfo({ bank: "", number: "", date: "" });
    setOpNo("");
  }

  function submit() {
    setMessage(null);
    const modes = [cash && "Cash", check && "Check", mo && "Money Order"].filter(Boolean) as Array<"Cash" | "Check" | "Money Order">;
    const instruments = [
      check ? { kind: "Check" as const, ...checkInfo } : null,
      mo ? { kind: "Money Order" as const, ...moInfo } : null,
    ].filter(Boolean) as Array<{ kind: "Check" | "Money Order"; bank: string; number: string; date: string }>;
    const body = {
      date,
      payor,
      fundId,
      division,
      opNo: noOp ? null : opNo,
      modes,
      instruments,
      lines: lines
        .filter((l) => l.natureId && toCents(l.amount) > 0)
        .map((l) => ({ natureId: Number(l.natureId), amount: l.amount, descriptions: l.descs.map((d) => d.trim()).filter(Boolean) })),
    };
    start(async () => {
      if (p.edit) {
        const res = await updateReceiptAction(p.edit.id, { ...body, controlNo: typedNo ?? undefined, voidReason: isVoided ? voidReason : undefined });
        if (res.ok) router.push(`/receipts/${p.edit.id}`);
        else setMessage({ kind: "bad", text: res.error });
        return;
      }
      const res = await postReceiptAction({ ...body, officerId, controlNo: numberTouched && typedNo !== null ? typedNo : undefined });
      if (res.ok) {
        setMessage({
          kind: "ok",
          id: res.id,
          text: `Posted OR No. ${res.controlNo} for ${peso(res.totalCents)}.${res.bookExhausted ? (res.nextBookNo ? ` That book is used up. Book ${res.nextBookNo} is now active.` : " That book is used up. Set another book active.") : ""}`,
        });
        reset();
      } else {
        setMessage({ kind: "bad", text: res.error });
      }
    });
  }

  const paper = { border: "1.5px solid var(--ink2)" } as const;
  const rule = "1.5px solid var(--ink2)";

  return (
    <div className="grid2">
      <div className="paper" style={{ padding: 0, gap: 0, borderRadius: 6, overflow: "hidden", ...paper }}>
        <div className="note" style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", padding: "8px 12px" }}>
          <span>Accountable Form No. 51-C · Revised January, 1992</span>
          <b style={{ color: "var(--ink)" }}>(ORIGINAL)</b>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "110px minmax(0,1fr)", borderTop: rule }}>
          <div style={{ borderRight: rule, display: "grid", placeItems: "center", padding: 10, color: "var(--ink3)", fontSize: 11, textAlign: "center" }}>[Republic seal]</div>
          <div>
            <div style={{ textAlign: "center", fontWeight: 700, padding: 8, borderBottom: rule, lineHeight: 1.25 }}>
              Official Receipt
              <br />
              of the
              <br />
              Republic of the Philippines
            </div>
            <div style={{ padding: "8px 12px", borderBottom: rule }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <span style={{ fontFamily: "var(--display)", fontSize: 22 }}>
                  N<sup>o</sup>
                </span>
                <input
                  id="r-no"
                  className="num"
                  inputMode="numeric"
                  aria-label="OR control number"
                  aria-describedby="r-no-hint"
                  value={shownNo}
                  onChange={(e) => {
                    setNumberText(e.target.value.replace(/\D/g, ""));
                    setNumberTouched(true);
                  }}
                  placeholder="—"
                  style={{ fontSize: 28, letterSpacing: ".08em", height: 48, width: "min(250px,100%)", borderWidth: 1 }}
                />
              </div>
              <div className="note" id="r-no-hint" aria-live="polite">
                {holder
                  ? `Book ${holder.bookNo} · ${holder.fromNo}–${holder.toNo}`
                  : typedNo !== null
                    ? "Not in any of this officer's registered books"
                    : "No active book for this officer. Type a number from one of their books."}
                {!p.edit && numberTouched && suggested !== null && typedNo !== suggested ? (
                  <>
                    {" · "}
                    <button type="button" className="link sm" onClick={() => { setNumberTouched(false); setNumberText(""); }}>
                      Use the suggested {suggested}
                    </button>
                  </>
                ) : null}
              </div>
            </div>
            <div style={{ padding: "6px 12px", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
              <label htmlFor="r-date" style={{ margin: 0 }}>
                Date
              </label>
              <input id="r-date" type="date" value={date} disabled={locked} onChange={(e) => setDate(e.target.value)} style={{ height: 38, maxWidth: 190, borderWidth: 1 }} />
            </div>
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
            <label htmlFor="r-fund" style={{ marginBottom: 2 }}>
              Fund
            </label>
            <div className="sel">
              <select id="r-fund" value={fundId} disabled={locked} onChange={(e) => setFundId(Number(e.target.value))} style={{ height: 38, borderWidth: 1 }}>
                {p.funds.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
        <div style={{ padding: "8px 12px", borderTop: rule }}>
          <label htmlFor="r-payor" style={{ marginBottom: 2 }}>
            Payor
          </label>
          <input id="r-payor" list="dl-payor" autoComplete="off" value={payor} onChange={(e) => setPayor(e.target.value)} placeholder="Type to search your client list" style={{ height: 40, borderWidth: 1 }} />
          <datalist id="dl-payor">
            {p.payors.map((n) => (
              <option key={n} value={n} />
            ))}
          </datalist>
        </div>

        <div className="scroll" style={{ borderTop: rule }}>
          <table className="mini" style={{ minWidth: 480 }}>
            <thead>
              <tr>
                <th>Nature of collection</th>
                <th style={{ textAlign: "right", width: 190 }}>Amount (₱)</th>
              </tr>
            </thead>
            <tbody>
              {lines.map((l, i) => (
                <LineRow
                  key={l.key}
                  index={i}
                  line={l}
                  natures={p.natures}
                  canRemove={lines.length > 1 && !locked}
                  lockAmount={locked}
                  onChange={(patch) => setLine(l.key, patch)}
                  onRemove={() => setLines((ls) => ls.filter((x) => x.key !== l.key))}
                />
              ))}
            </tbody>
            <tfoot>
              <tr>
                <td style={{ textAlign: "right", fontWeight: 700, borderTop: rule }}>TOTAL ₱</td>
                <td className="amt num" style={{ borderTop: rule, fontSize: 18 }}>
                  {peso(totalCents).replace("₱ ", "")}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
        {lines.length < 8 && !locked ? (
          <div style={{ padding: "4px 12px", borderTop: "1px solid var(--line2)" }}>
            <button type="button" className="link sm" onClick={() => setLines((ls) => [...ls, newLine()])}>
              + Add another nature of collection
            </button>
          </div>
        ) : null}
        <datalist id="dl-desc">
          {p.descriptions.map((d) => (
            <option key={d} value={d} />
          ))}
        </datalist>

        <div style={{ padding: "8px 12px", borderTop: rule }}>
          <span className="lbl" style={{ marginBottom: 2 }}>
            Amount in words
          </span>
          <p style={{ fontFamily: "var(--display)", fontSize: 20, overflowWrap: "anywhere", minHeight: 28 }}>{totalCents > 0 ? amountInWords(totalCents) : ""}</p>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "minmax(150px,.4fr) minmax(0,1fr)", borderTop: rule }}>
          <div className="seg" style={{ flexDirection: "column", padding: "10px 12px", borderRight: rule }}>
            <input type="checkbox" id="m-cash" checked={cash} disabled={locked} onChange={(e) => setCash(e.target.checked)} />
            <label htmlFor="m-cash">Cash</label>
            <input type="checkbox" id="m-check" checked={check} disabled={locked} onChange={(e) => setCheck(e.target.checked)} />
            <label htmlFor="m-check">Check</label>
            <input type="checkbox" id="m-mo" checked={mo} disabled={locked} onChange={(e) => setMo(e.target.checked)} />
            <label htmlFor="m-mo">Money Order</label>
          </div>
          <div className="scroll">
            <table className="mini" style={{ minWidth: 340 }}>
              <thead>
                <tr>
                  <th>Drawee bank</th>
                  <th>Number</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                <InstrumentRow label="Check" enabled={check} value={checkInfo} onChange={setCheckInfo} />
                <InstrumentRow label="Money order" enabled={mo} value={moInfo} onChange={setMoInfo} />
              </tbody>
            </table>
          </div>
        </div>

        <div style={{ padding: 12, borderTop: rule }}>
          <p>Received the amount stated above.</p>
          <div style={{ margin: "22px auto 0", width: "min(340px,100%)", textAlign: "center" }}>
            <div className="sel">
              <select
                aria-label="Collecting officer"
                value={officerId}
                disabled={p.lockedOfficerId !== null || !!p.edit}
                onChange={(e) => { setOfficerId(Number(e.target.value)); setNumberTouched(false); setNumberText(""); }}
                style={{ height: 40, borderWidth: 1, textAlign: "center", fontWeight: 700 }}
              >
                {p.officers.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ borderTop: "1px dotted var(--ink3)", paddingTop: 4, marginTop: 6 }}>Collecting Officer</div>
          </div>
        </div>
        <p className="note" style={{ padding: "8px 12px", borderTop: rule }}>
          NOTE: Write the number and date of this receipt on the back of check or money order received.
        </p>
      </div>

      <div className="sticky-col" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {isVoided ? (
          <div className="card" role="status" style={{ borderColor: "var(--alert-fg)" }}>
            <span className="lbl" style={{ color: "var(--alert-fg)" }}>This receipt is voided</span>
            <p className="note" style={{ marginBottom: 10 }}>It stays out of every total and report amount. You can still correct what was written on it and why it was voided.</p>
            <label htmlFor="r-void">Reason it was voided</label>
            <input id="r-void" value={voidReason} onChange={(e) => setVoidReason(e.target.value)} />
          </div>
        ) : null}
        {p.edit?.depositSlip ? (
          <div className="card" role="status" style={{ borderColor: "var(--seal)" }}>
            <span className="lbl">On deposit slip {p.edit.depositSlip}</span>
            <p className="note">Amounts, payment mode, fund and date are locked while the receipt is deposited. You can still correct the payor, natures, descriptions, division, order of payment and the OR number. To change the rest, remove the deposit first.</p>
          </div>
        ) : null}
        {!canPost ? (
          <div className="alert" role="alert">
            {typedNo !== null
              ? "That number is not in any of this collecting officer's registered books."
              : "This collecting officer has no active OR book, and no number is entered."}{" "}
            <Link href="/books" style={{ color: "inherit" }}>Open OR books</Link>
          </div>
        ) : null}
        <div className="card">
          <h3 style={{ marginBottom: 8 }}>{p.edit ? `Correct ${isVoided ? "voided " : ""}OR No. ${p.edit.controlNo}` : "Posting"}</h3>
          {lines.filter((l) => l.natureId && toCents(l.amount) > 0).map((l) => (
            <div className="kv" key={l.key}>
              <span>
                {p.natures.find((n) => String(n.id) === l.natureId)?.name}
                <br />
                <span className="note">
                  {p.funds.find((f) => f.id === fundId)?.name}
                  {l.descs.filter(Boolean).length ? ` · ${l.descs.filter(Boolean).join(" / ")}` : ""}
                </span>
              </span>
              <span>{peso(toCents(l.amount))}</span>
            </div>
          ))}
          {totalCents === 0 ? <p className="note">Add a nature of collection and amount.</p> : null}
          <div className="kv tot">
            <span>{p.edit ? "Total" : "Total to post"}</span>
            <span>{peso(totalCents)}</span>
          </div>
          <div className="kv" style={{ marginTop: 8 }}>
            <span>Control number</span>
            <span className="num">{shownNo || "—"}</span>
          </div>
          <div role="status" aria-live="polite" style={{ marginTop: 8 }}>
            {message ? (
              <p className={`fld-msg ${message.kind}`}>
                {message.text}{" "}
                {message.id ? (
                  <Link href={`/receipts/${message.id}`} className="link sm">
                    View receipt
                  </Link>
                ) : null}
              </p>
            ) : null}
          </div>
          <div className="actions" style={{ marginTop: 8 }}>
            {p.edit ? (
              <Link className="btn out" href={`/receipts/${p.edit.id}`}>
                Cancel
              </Link>
            ) : (
              <button className="btn out" type="button" onClick={() => { reset(); setMessage(null); }}>
                Clear form
              </button>
            )}
            <ReceiptPrint data={printData} />
            <button className="btn" type="button" disabled={!canPost || pending} onClick={submit}>
              {p.edit ? (pending ? "Saving…" : "Save changes") : pending ? "Posting…" : "Post receipt"}
            </button>
          </div>
        </div>
        <div className="card">
          <span className="lbl">For the reports</span>
          <div className="form" style={{ gridTemplateColumns: "minmax(0,1fr)" }}>
            <div>
              <label htmlFor="r-div">Division</label>
              <div className="sel">
                <select
                  id="r-div"
                  value={addingDiv ? "__new" : division}
                  onChange={(e) => {
                    if (e.target.value === "__new") {
                      setAddingDiv(true);
                      setDivError(null);
                    } else {
                      setAddingDiv(false);
                      setDivision(e.target.value);
                    }
                  }}
                >
                  {divs.map((d) => (
                    <option key={d.code} value={d.code}>
                      {d.code}
                      {d.rccCode ? ` · ${d.rccCode}` : ""}
                    </option>
                  ))}
                  <option value="__new">+ Add a division…</option>
                </select>
              </div>
              {addingDiv ? (
                <div className="drawer" style={{ marginTop: 10, padding: 14, gap: 10 }}>
                  <div>
                    <label htmlFor="nd-code">New division</label>
                    <input id="nd-code" value={newDiv.code} onChange={(e) => setNewDiv({ ...newDiv, code: e.target.value.toUpperCase() })} placeholder="e.g. MGD" autoFocus autoComplete="off" />
                  </div>
                  <div>
                    <label htmlFor="nd-rcc">Code on the RCD (optional)</label>
                    <input id="nd-rcc" inputMode="numeric" value={newDiv.rcc} onChange={(e) => setNewDiv({ ...newDiv, rcc: e.target.value.replace(/\D/g, "").slice(0, 3) })} placeholder="e.g. 06" aria-describedby="nd-rcc-help" />
                    <span id="nd-rcc-help" className="help">Printed in the Div column of the RCD. Leave blank if it has none, like MTSS.</span>
                  </div>
                  <label className="check-row">
                    <input type="checkbox" checked={newDiv.noOp} onChange={(e) => setNewDiv({ ...newDiv, noOp: e.target.checked })} />
                    It controls its own order-of-payment numbers
                  </label>
                  {divError ? (
                    <p className="alert" role="alert">
                      {divError}
                    </p>
                  ) : null}
                  <div className="actions">
                    <button className="btn out" type="button" onClick={() => { setAddingDiv(false); setDivError(null); }}>
                      Cancel
                    </button>
                    <button
                      className="btn"
                      type="button"
                      disabled={divPending || newDiv.code.trim().length < 2}
                      onClick={() =>
                        startDiv(async () => {
                          const res = await addDivisionAction({ code: newDiv.code, rccCode: newDiv.rcc || null, noOpNumber: newDiv.noOp });
                          if (!res.ok) return setDivError(res.error);
                          setDivs((list) => [...list, { code: res.code, rccCode: res.rccCode, noOpNumber: res.noOpNumber }]);
                          setDivision(res.code);
                          setAddingDiv(false);
                          setNewDiv({ code: "", rcc: "", noOp: false });
                        })
                      }
                    >
                      {divPending ? "Adding…" : "Add division"}
                    </button>
                  </div>
                </div>
              ) : null}
            </div>
            <div>
              <label htmlFor="r-op">Order of payment no.</label>
              <input id="r-op" inputMode="numeric" value={noOp ? "" : opNo} disabled={noOp} onChange={(e) => setOpNo(e.target.value)} placeholder={noOp ? "Controlled by this division, left blank" : "e.g. 202610022"} />
            </div>
          </div>
          <p className="note" style={{ marginTop: 8 }}>
            Shown on the RCD. Not printed on the receipt. A division that controls its own numbers, like MTSS, leaves the order of payment blank.
          </p>
        </div>
      </div>
    </div>
  );
}

function LineRow({
  index, line, natures, canRemove, lockAmount, onChange, onRemove,
}: {
  index: number;
  line: Line;
  natures: Array<{ id: number; name: string }>;
  canRemove: boolean;
  lockAmount: boolean;
  onChange: (patch: Partial<Line>) => void;
  onRemove: () => void;
}) {
  const setDesc = (i: number, v: string) => onChange({ descs: line.descs.map((d, j) => (j === i ? v : d)) });
  return (
    <>
      <tr className="ln">
        <td>
          <div className="sel">
            <select aria-label={`Nature of collection, line ${index + 1}`} value={line.natureId} onChange={(e) => onChange({ natureId: e.target.value })}>
              <option value="">—</option>
              {natures.map((n) => (
                <option key={n.id} value={n.id}>
                  {n.name}
                </option>
              ))}
            </select>
          </div>
          {line.descs.length < 2 ? (
            <button type="button" className="link sm" onClick={() => onChange({ descs: [...line.descs, ""] })}>
              {line.descs.length ? "+ Add another line" : "+ Add description"}
            </button>
          ) : null}
        </td>
        <td>
          <input className="amt" inputMode="decimal" aria-label={`Amount, line ${index + 1}`} value={line.amount} disabled={lockAmount} onChange={(e) => onChange({ amount: e.target.value })} />
          {canRemove ? (
            <button type="button" className="link sm" onClick={onRemove}>
              Remove line
            </button>
          ) : null}
        </td>
      </tr>
      {line.descs.length ? (
        <tr className="dr">
          <td colSpan={2}>
            {line.descs.map((d, i) => (
              <div className="dline" key={i}>
                <input list="dl-desc" autoComplete="off" placeholder="Description, e.g. ISGPA or MPSA No." aria-label={`Description line ${i + 1}, nature line ${index + 1}`} value={d} onChange={(e) => setDesc(i, e.target.value)} />
                <button type="button" className="link sm" aria-label={`Remove description line ${i + 1}`} onClick={() => onChange({ descs: line.descs.filter((_, j) => j !== i) })}>
                  Remove
                </button>
              </div>
            ))}
          </td>
        </tr>
      ) : null}
    </>
  );
}

function InstrumentRow({
  label, enabled, value, onChange,
}: {
  label: string;
  enabled: boolean;
  value: { bank: string; number: string; date: string };
  onChange: (v: { bank: string; number: string; date: string }) => void;
}) {
  return (
    <tr>
      <td>
        <input aria-label={`${label} drawee bank`} disabled={!enabled} value={value.bank} onChange={(e) => onChange({ ...value, bank: e.target.value })} />
      </td>
      <td>
        <input aria-label={`${label} number`} disabled={!enabled} value={value.number} onChange={(e) => onChange({ ...value, number: e.target.value })} />
      </td>
      <td>
        <input type="date" aria-label={`${label} date`} disabled={!enabled} value={value.date} onChange={(e) => onChange({ ...value, date: e.target.value })} />
      </td>
    </tr>
  );
}
