import { desc, eq } from "drizzle-orm";
import { DepositBoard, ValidateCell } from "@/components/DepositBoard";
import { db, schema } from "@/db";
import { DEPOSITORY_BANK } from "@/lib/constants";
import { fmtDate, todayISO } from "@/lib/dates";
import { surname } from "@/lib/text";
import { peso } from "@/lib/money";
import { canActFor, requireUser } from "@/lib/session";
import { nextSlipNo } from "@/services/deposits";
import { getLookups } from "@/services/lookups";
import { loadReportData } from "@/services/report-data";
import { isCash } from "@/services/reports/compute";

export const dynamic = "force-dynamic";
export const metadata = { title: "Deposits" };

export default async function DepositsPage({ searchParams }: { searchParams: Promise<{ officer?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const [lookups, data, slip] = await Promise.all([getLookups(), loadReportData("9999-12-31"), nextSlipNo()]);
  const requested = Number(sp.officer);
  const officerId =
    user.role === "admin" && lookups.officers.some((o) => o.id === requested) ? requested : (user.officerId ?? lookups.officers[0].id);

  const posted = data.receipts.filter((r) => r.status === "posted");
  const undeposited = posted.filter((r) => !r.depositId);
  const mine = undeposited.filter((r) => r.officerId === officerId).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.controlNo - b.controlNo));
  const ids = new Map(
    (await db.select({ id: schema.receipts.id, controlNo: schema.receipts.controlNo }).from(schema.receipts).where(eq(schema.receipts.officerId, officerId))).map((r) => [r.controlNo, r.id]),
  );
  const history = await db.select().from(schema.deposits).orderBy(desc(schema.deposits.depositDate), desc(schema.deposits.id));
  const sum = (rs: typeof posted) => rs.reduce((a, r) => a + r.totalCents, 0);

  const inTransit = history
    .filter((d) => !d.bankMsgNo)
    .reduce((a, d) => a + sum(posted.filter((r) => r.depositId === d.id)), 0);
  const officerName = (id: number) => surname(lookups.officers.find((o) => o.id === id)?.name ?? "");

  return (
    <div className="scr">
      <div className="head">
        <div>
          <p className="eyebrow">Collections · Deposits</p>
          <div className="t">Deposits</div>
          <p className="sub">Pick the receipts that go on a deposit slip, record the deposit, then enter the bank&apos;s message number once it is validated.</p>
        </div>
      </div>

      <div className="tiles">
        <div className="tile">
          <span className="l">Awaiting deposit</span>
          <span className="v">{peso(sum(undeposited)).replace(/\.00$/, "")}</span>
          <span className="note">{undeposited.length} receipts</span>
        </div>
        <div className="tile">
          <span className="l">Cash on hand</span>
          <span className="v">{peso(sum(undeposited.filter(isCash))).replace(/\.00$/, "")}</span>
          <span className="note">Undeposited cash</span>
        </div>
        <div className="tile">
          <span className="l">Checks on hand</span>
          <span className="v">{peso(sum(undeposited.filter((r) => !isCash(r)))).replace(/\.00$/, "")}</span>
          <span className="note">Checks and money orders</span>
        </div>
        <div className="tile">
          <span className="l">In transit</span>
          <span className="v">{peso(inTransit).replace(/\.00$/, "")}</span>
          <span className="note">Deposited, bank not yet validated</span>
        </div>
      </div>

      <DepositBoard
        officers={lookups.officers}
        officerId={officerId}
        lockedOfficerId={user.role === "admin" ? null : user.officerId}
        waiting={mine.map((r) => ({ id: ids.get(r.controlNo)!, controlNo: r.controlNo, date: r.date, payor: r.payor, modes: r.modes, cents: r.totalCents }))}
        suggestedSlip={slip}
        today={todayISO()}
        bank={DEPOSITORY_BANK}
      />

      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
          <h3>Deposit history</h3>
          <span className="note">Newest first</span>
        </div>
        <div className="scroll">
          <table className="mini" style={{ minWidth: 860 }}>
            <thead>
              <tr>
                <th>Deposit date</th>
                <th>Slip no.</th>
                <th>Collecting officer</th>
                <th style={{ textAlign: "right" }}>Cash</th>
                <th style={{ textAlign: "right" }}>Checks</th>
                <th style={{ textAlign: "right" }}>Total</th>
                <th>Bank message no.</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {history.length === 0 ? (
                <tr>
                  <td colSpan={8} className="note" style={{ padding: 18 }}>
                    No deposits recorded yet.
                  </td>
                </tr>
              ) : null}
              {history.map((d) => {
                const rs = posted.filter((r) => r.depositId === d.id);
                const cash = sum(rs.filter(isCash));
                const total = sum(rs);
                return (
                  <tr key={d.id}>
                    <td>{fmtDate(d.depositDate)}</td>
                    <td className="num">{d.slipNo}</td>
                    <td>{officerName(d.officerId)}</td>
                    <td className="amt num">{peso(cash)}</td>
                    <td className="amt num">{peso(total - cash)}</td>
                    <td className="amt num">
                      <b>{peso(total)}</b>
                    </td>
                    <td>{d.bankMsgNo ? <span className="num">{d.bankMsgNo}</span> : <ValidateCell id={d.id} slipNo={d.slipNo} canAct={canActFor(user, d.officerId)} />}</td>
                    <td>
                      <span className={`pill ${d.bankMsgNo ? "done" : "wait"}`}>{d.bankMsgNo ? "Validated" : "In transit"}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
