import { fmt, fmtBlank } from "@/lib/money";
import { fmtDate, fmtShort } from "@/lib/dates";
import { titleCase } from "@/lib/text";
import type { MrdcModel, RcdModel, ReportModel, RevModel, SdcModel, Signatory } from "@/services/reports/build";

function Sign({ list }: { list: Array<{ label?: string; name: string; title: string | null }> }) {
  return (
    <div className="sig">
      {list.map((s, i) => (
        <div key={i}>
          {s.label ? <>{s.label}<br /></> : null}
          <b>{s.name}</b>
          {s.title ? <><br />{s.title}</> : null}
        </div>
      ))}
    </div>
  );
}

function Rcd({ m }: { m: RcdModel }) {
  const r = m.result;
  const rng = r.orFrom !== null ? `${r.orFrom}–${r.orTo}` : "—";
  return (
    <>
      <h2>{m.title}</h2>
      <p style={{ textAlign: "center" }}>{m.periodLabel}</p>
      <div className="meta">
        <div><b>Entity Name:</b> {m.entityName}</div>
        <div><b>Fund Cluster:</b> {m.fundCluster}</div>
        <div><b>Report No.:</b> {m.reportNo || "________"}</div>
        <div><b>Date:</b> {m.periodLabel}</div>
      </div>
      <p><b>Official Receipt / Report of Collections by Sub-Collector</b></p>
      <div className="scroll">
        <table className="wide">
          <thead>
            <tr>
              <th>Date</th><th>OR No.</th><th>Responsibility Center Code</th><th>Div</th><th>Payor</th><th>Particular</th>
              <th style={{ textAlign: "right" }}>Amount</th>
              {m.groups.map((g) => (
                <th key={g.code} style={{ textAlign: "right" }}>{g.name}<br /><span className="num">{g.code}</span></th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="gh"><td colSpan={13}>Balance forward</td></tr>
            <tr><td colSpan={6}>Undeposited collections per last report</td><td className="amt num">{fmt(r.balanceForward)}</td><td colSpan={6} /></tr>
            {r.groups.length === 0 ? (
              <tr><td colSpan={13} className="note" style={{ padding: 18 }}>No receipts for this fund and collecting officer in this period.</td></tr>
            ) : null}
            {r.groups.map((g, gi) => (
              <GroupRows key={gi} m={m} g={g} />
            ))}
            <tr className="st">
              <td colSpan={6} style={{ textAlign: "right" }}>Total</td>
              <td className="amt num">{fmt(r.total.cents)}</td>
              {r.total.byGroup.map((c, i) => <td key={i} className="amt num">{fmt(c)}</td>)}
            </tr>
          </tbody>
        </table>
      </div>
      <p style={{ marginTop: 14 }}><b>Summary</b></p>
      <div className="sum">
        <div className="kv"><span>Undeposited collections per last report</span><span>{fmt(r.balanceForward)}</span></div>
        <div className="kv"><span>Collections per OR Nos. {rng}</span><span>{fmt(r.total.cents)}</span></div>
        <div className="kv tot"><span>TOTAL</span><span>{fmt(r.balanceForward + r.total.cents)}</span></div>
        <div className="kv"><span>Deposits, {m.periodLabel}</span><span>{fmt(r.depositsCents)}</span></div>
        <div className="kv tot"><span>Undeposited collections, this report</span><span>{fmt(r.undepositedCents)}</span></div>
      </div>
      <p style={{ marginTop: 16 }}><b>CERTIFICATION</b></p>
      <p className="cert">
        I hereby certify on my official oath that the above is a true statement of all collections and deposits had by me during the period stated above for which Official Receipt Nos. {rng} inclusive, were actually issued by me in the amounts shown thereon. I also certify that I have not received money from whatever source without having issued the necessary Official Receipt in acknowledgement thereof. Collections received by sub-collectors are recorded above in lump-sum opposite their respective collection report numbers. I certify further that the balance shown above agrees with the balance appearing in my Cash Receipts Record.
      </p>
      <Sign list={[{ name: m.officer.name, title: m.officer.title }]} />
    </>
  );
}

function GroupRows({ m, g }: { m: RcdModel; g: RcdModel["result"]["groups"][number] }) {
  return (
    <>
      <tr className="gh">
        <td colSpan={13}>{g.deposit ? `Deposit slip ${g.deposit.slipNo} · ${fmtDate(g.deposit.date)}${g.deposit.bankMsgNo ? "" : " · in transit"}` : "Not yet deposited"}</td>
      </tr>
      {g.receipts.map((r) =>
        r.status === "voided" ? (
          <tr key={r.controlNo} className="voided">
            <td>{fmtShort(r.date)}</td>
            <td className="num">{r.controlNo}</td>
            <td className="num">{m.rcc}</td>
            <td /><td>CANCELLED</td><td colSpan={8}>Voided receipt, not counted</td>
          </tr>
        ) : (
          r.lines.map((l, i) => (
            <tr key={`${r.controlNo}-${i}`}>
              {i === 0 ? (
                <>
                  <td>{fmtShort(r.date)}</td>
                  <td className="num">{r.controlNo}</td>
                  <td className="num">{m.rcc}</td>
                  <td>{r.division ? (m.divisionCodes[r.division] ?? "") : ""}</td>
                  <td>{r.payor}</td>
                </>
              ) : (
                <><td /><td /><td /><td /><td /></>
              )}
              <td>
                <b>{titleCase(l.nature)}</b>
                {l.descriptions.length ? <><br />{l.descriptions.join(" · ")}</> : null}
                {i === 0 && r.opNo ? <><br /><span className="note">OP No. {r.division} {r.opNo}</span></> : null}
              </td>
              <td className="amt num">{fmt(l.cents)}</td>
              {m.groups.map((_, k) => <td key={k} className="amt num">{k === l.group ? fmt(l.cents) : ""}</td>)}
            </tr>
          ))
        ),
      )}
      <tr className="st">
        <td colSpan={6} style={{ textAlign: "right" }}>Sub Total</td>
        <td className="amt num">{fmt(g.subtotal.cents)}</td>
        {g.subtotal.byGroup.map((c, i) => <td key={i} className="amt num">{fmt(c)}</td>)}
      </tr>
    </>
  );
}

function Mrdc({ m }: { m: MrdcModel }) {
  const r = m.result;
  const sig = m.signatories as Signatory[];
  return (
    <>
      <h2>{m.title}</h2>
      <p style={{ textAlign: "center" }}>{m.periodLabel}</p>
      <div className="meta">
        <div><b>Name of NCO/LT:</b> {m.officerName}</div>
        <div><b>Agency:</b> {m.agency}</div>
        <div><b>Address:</b> {m.address}</div>
      </div>
      <div className="scroll">
        <table style={{ minWidth: 720 }}>
          <thead>
            <tr><th colSpan={3}>COLLECTION</th><th colSpan={3}>DEPOSITS</th><th style={{ textAlign: "right" }}>CASH ON HAND</th></tr>
            <tr><th>Date</th><th>OR No.</th><th style={{ textAlign: "right" }}>Amount</th><th>Date</th><th>Slip no.</th><th style={{ textAlign: "right" }}>Amount</th><th /></tr>
          </thead>
          <tbody>
            <tr><td /><td>Balance forward</td><td /><td /><td /><td /><td className="amt num">{fmt(r.beginning)}</td></tr>
            {r.rows.map((x, i) => (
              <tr key={i}>
                <td>{fmtShort(x.collectionDate)}</td>
                <td className="num">{x.orFrom} – {x.orTo}</td>
                <td className="amt num">{fmt(x.collectedCents)}</td>
                <td>{x.deposit ? fmtShort(x.deposit.date) : <span className="note">Not yet deposited</span>}</td>
                <td className="num">{x.deposit?.slipNo}</td>
                <td className="amt num">{x.deposit ? fmt(x.deposit.cents) : ""}</td>
                <td className="amt num">{fmt(x.cashOnHandCents)}</td>
              </tr>
            ))}
            <tr className="st">
              <td colSpan={2} style={{ textAlign: "right" }}>TOTAL</td><td className="amt num">{fmt(r.collectionsCents)}</td>
              <td colSpan={2} style={{ textAlign: "right" }}>TOTAL</td><td className="amt num">{fmt(r.depositedCents)}</td><td />
            </tr>
          </tbody>
        </table>
      </div>
      <p style={{ marginTop: 14 }}><b>CASH ON HAND SUMMARY:</b></p>
      <div className="sum">
        <div className="kv"><span>Beginning Balance</span><span>{fmt(r.beginning)}</span></div>
        <div className="kv"><span>Add: Collections for the month</span><span>{fmt(r.collectionsCents)}</span></div>
        <div className="kv"><span>Total</span><span>{fmt(r.beginning + r.collectionsCents)}</span></div>
        <div className="kv"><span>Less: Deposits for the month</span><span>{fmt(r.depositsForMonth)}</span></div>
        <div className="kv tot"><span>Ending Balance</span><span>{fmt(r.ending)}</span></div>
      </div>
      <Sign list={sig} />
    </>
  );
}

function Sdc({ m }: { m: SdcModel }) {
  const r = m.result;
  return (
    <>
      <h2>{m.title}</h2>
      <p style={{ textAlign: "center" }}>{m.periodLabel}</p>
      <div className="meta">
        <div><b>{m.cashier.name}</b><br />{m.cashier.title}</div>
        <div>{m.agency}</div>
        <div><b>{m.bank}</b><br />DEPOSITORY BANK</div>
      </div>
      <div className="scroll">
        <table style={{ minWidth: 640 }}>
          <thead>
            <tr><th>Deposit date</th><th>Validated deposit slip no.</th><th style={{ textAlign: "right" }}>Cash</th><th style={{ textAlign: "right" }}>Checks</th><th>Bank message number</th><th style={{ textAlign: "right" }}>Total amount deposited</th></tr>
          </thead>
          <tbody>
            {r.rows.map((x) => (
              <tr key={x.slipNo}>
                <td>{fmtDate(x.date)}</td><td className="num">{x.slipNo}</td>
                <td className="amt num">{fmtBlank(x.cashCents)}</td><td className="amt num">{fmtBlank(x.checkCents)}</td>
                <td>{x.bankMsgNo ? <span className="num">{x.bankMsgNo}</span> : <span className="pill wait">In transit</span>}</td>
                <td className="amt num">{fmt(x.totalCents)}</td>
              </tr>
            ))}
            <tr className="st"><td colSpan={2} style={{ textAlign: "right" }}>TOTAL</td><td className="amt num">{fmt(r.cashCents)}</td><td className="amt num">{fmt(r.checkCents)}</td><td /><td className="amt num">{fmt(r.totalCents)}</td></tr>
          </tbody>
        </table>
      </div>
      <p className="note" style={{ marginTop: 8 }}>Validated by the bank so far: {fmt(r.validatedCents)}. In transit: {fmt(r.inTransitCents)}.</p>
      <Sign list={m.signatories} />
    </>
  );
}

function Rev({ m }: { m: RevModel }) {
  const r = m.result;
  return (
    <>
      <h2>MINES AND GEOSCIENCES BUREAU</h2>
      <p style={{ textAlign: "center" }}>REGIONAL OFFICE NO.: III<br /><b>{m.title}</b><br />FOR THE MONTH OF {m.periodLabel}</p>
      <div className="scroll" style={{ marginTop: 12 }}>
        <table style={{ minWidth: 640 }}>
          <thead><tr><th>Source</th><th>Accounting code</th><th style={{ textAlign: "right" }}>Receipts</th><th style={{ textAlign: "right" }}>Collection</th><th>Share</th></tr></thead>
          <tbody>
            {r.groups.map((g) => (
              <GroupRev key={g.group} m={m} g={g} total={r.totalCents} />
            ))}
            {r.groups.length === 0 ? <tr><td colSpan={5} className="note" style={{ padding: 18 }}>No collections this month.</td></tr> : null}
            <tr className="st"><td colSpan={3} style={{ textAlign: "right" }}>TOTAL</td><td className="amt num">{fmt(r.totalCents)}</td><td /></tr>
          </tbody>
        </table>
      </div>
    </>
  );
}

function GroupRev({ m, g, total }: { m: RevModel; g: RevModel["result"]["groups"][number]; total: number }) {
  const def = m.groups[g.group];
  return (
    <>
      <tr className="gh"><td colSpan={5}>{def.name} · <span className="num">{def.code}</span></td></tr>
      {g.items.map((x) => (
        <tr key={x.nature}>
          <td>{titleCase(x.nature)}</td><td className="num">{def.code}</td><td className="amt num">{x.count}</td><td className="amt num">{fmt(x.cents)}</td>
          <td style={{ width: 140 }}>
            <div className="bar" role="img" aria-label={`${Math.round((x.cents / total) * 100)} percent of total`}><i style={{ width: `${(x.cents / total) * 100}%` }} /></div>
          </td>
        </tr>
      ))}
      <tr className="st"><td colSpan={3} style={{ textAlign: "right" }}>Sub Total</td><td className="amt num">{fmt(g.subtotalCents)}</td><td /></tr>
    </>
  );
}

export function ReportView({ model }: { model: ReportModel }) {
  return (
    <div className="paper rp" style={{ overflowX: "auto" }}>
      {model.kind === "rcd" ? <Rcd m={model} /> : model.kind === "mrdc" ? <Mrdc m={model} /> : model.kind === "sdc" ? <Sdc m={model} /> : <Rev m={model} />}
    </div>
  );
}
