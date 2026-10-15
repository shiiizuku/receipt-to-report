import Link from "next/link";
import { ACCOUNT_GROUPS, AGENCY } from "@/lib/constants";
import { fmtDate, halfBounds, todayISO } from "@/lib/dates";
import { fmt, peso } from "@/lib/money";
import { firstName, surname } from "@/lib/text";
import { requireUser } from "@/lib/session";
import { listBooks } from "@/services/books";
import { listReceipts } from "@/services/receipts";
import { loadReportData } from "@/services/report-data";
import { columnTotals, isCash } from "@/services/reports/compute";
import { getLookups } from "@/services/lookups";

export const dynamic = "force-dynamic";
export const metadata = { title: "Today" };

export default async function TodayPage() {
  const user = await requireUser();
  const today = todayISO();
  const [y, m] = today.split("-").map(Number);
  const half = halfBounds(y, m, Number(today.slice(8)) <= 15 ? "1" : "2");

  const [lookups, books, data, list] = await Promise.all([
    getLookups(),
    listBooks(),
    loadReportData(today),
    listReceipts({ from: today, to: today, pageSize: 100 }),
  ]);

  const posted = data.receipts.filter((r) => r.status === "posted");
  const undeposited = posted.filter((r) => !r.depositId);
  const period = posted.filter((r) => r.date >= half.from && r.date <= half.to);
  const todays = list.rows.filter((r) => r.status === "posted");
  const collectedToday = todays.reduce((a, r) => a + r.totalCents, 0);
  const periodCols = columnTotals(period);

  const perFund = lookups.funds.map((f) => {
    const rs = period.filter((r) => r.fundId === f.id);
    const cash = rs.filter(isCash).reduce((a, r) => a + r.totalCents, 0);
    const all = rs.reduce((a, r) => a + r.totalCents, 0);
    return { fund: f.name, cash, other: all - cash, total: all };
  });

  const officerBooks = lookups.officers.map((o) => {
    const b = books.find((x) => x.officerId === o.id && x.status === "active");
    return { officer: o, book: b };
  });
  const booksLeft = officerBooks.reduce((a, x) => a + (x.book?.left ?? 0), 0);

  return (
    <div className="scr">
      <div className="head">
        <div>
          <p className="eyebrow">
            {AGENCY} · {fmtDate(today)}
          </p>
          <div className="t">Good day, {firstName(user.displayName)}</div>
          <p className="sub">The report builds as you collect. Add a receipt when one comes in.</p>
        </div>
        <Link className="btn" href="/receipts/new">
          New receipt
        </Link>
      </div>

      <div className="tiles">
        <div className="tile">
          <span className="l">Collected today</span>
          <span className="v">{peso(collectedToday).replace(/\.00$/, "")}</span>
          <span className="note">Voided receipts are not counted</span>
        </div>
        <div className="tile">
          <span className="l">Receipts issued</span>
          <span className="v">{list.rows.length}</span>
          <span className="note">{list.rows.some((r) => r.status === "voided") ? `${list.rows.filter((r) => r.status === "voided").length} voided` : "Today"}</span>
        </div>
        <Link className="tile btn-tile" href="/deposits">
          <span className="l">Not yet deposited</span>
          <span className="v">{peso(undeposited.reduce((a, r) => a + r.totalCents, 0)).replace(/\.00$/, "")}</span>
          <span className="note">
            {undeposited.length} receipt{undeposited.length === 1 ? "" : "s"} · cash {peso(undeposited.filter(isCash).reduce((a, r) => a + r.totalCents, 0)).replace(/\.00$/, "")}
          </span>
          <span className="go">Go to deposits →</span>
        </Link>
        <Link className="tile btn-tile" href="/books">
          <span className="l">Active OR books</span>
          <span className="v">{booksLeft} left</span>
          <span className="note">
            {officerBooks.map((x) => (
              <span key={x.officer.id} style={{ display: "block" }}>
                {surname(x.officer.name)}: {x.book ? `Book ${x.book.bookNo}, ${x.book.left} left${x.book.left <= 10 ? " (low)" : ""}` : "none active"}
              </span>
            ))}
          </span>
          <span className="go">View OR books →</span>
        </Link>
      </div>

      <div className="grid2">
        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 6 }}>
            <h3>Today&apos;s receipts</h3>
            <span className="note">Newest first</span>
          </div>
          <div className="list">
            {list.rows.length === 0 ? <p className="note">No receipts yet today.</p> : null}
            {list.rows.map((r) => (
              <div className="li" key={r.id}>
                <div>
                  <Link href={`/receipts/${r.id}`} className="link sm" style={{ fontWeight: 600 }}>
                    {r.payor}
                  </Link>
                  <div className="note">
                    <span className="num">{r.controlNo}</span> · {r.firstNature}
                    {r.lineCount > 1 ? ` +${r.lineCount - 1} more` : ""} · {r.fundName} · {r.modes.join(" + ")} · {surname(r.officerName)}
                  </div>
                </div>
                <div className="a">
                  {r.status === "voided" ? "Voided" : peso(r.totalCents)}
                  <div>
                    {r.status === "voided" ? (
                      <span className="pill void">Voided</span>
                    ) : (
                      <span className={`pill ${r.depositSlip ? "done" : "move"}`}>{r.depositSlip ? "Deposited" : "Posted"}</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
            <h3>RCD, {half.label.replace(`, ${y}`, "")}</h3>
            <span className="pill move">Period open</span>
          </div>
          <p className="note">{AGENCY}</p>
          <div className="scroll" style={{ marginTop: 10 }}>
            <table className="mini">
              <thead>
                <tr>
                  <th>Fund</th>
                  <th style={{ textAlign: "right" }}>Cash</th>
                  <th style={{ textAlign: "right" }}>Check / M.O.</th>
                  <th style={{ textAlign: "right" }}>Total</th>
                </tr>
              </thead>
              <tbody>
                {perFund.map((f) => (
                  <tr key={f.fund}>
                    <td>{f.fund}</td>
                    <td className="amt num">{fmt(f.cash)}</td>
                    <td className="amt num">{fmt(f.other)}</td>
                    <td className="amt num">{fmt(f.total)}</td>
                  </tr>
                ))}
                <tr>
                  <td>
                    <b>Total</b>
                  </td>
                  <td className="amt num">
                    <b>{fmt(perFund.reduce((a, f) => a + f.cash, 0))}</b>
                  </td>
                  <td className="amt num">
                    <b>{fmt(perFund.reduce((a, f) => a + f.other, 0))}</b>
                  </td>
                  <td className="amt num">
                    <b>{fmt(perFund.reduce((a, f) => a + f.total, 0))}</b>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
          <details style={{ marginTop: 12 }}>
            <summary className="link sm">By account code</summary>
            <div className="scroll" style={{ marginTop: 8 }}>
              <table className="mini">
                <thead>
                  <tr>
                    <th>Account code</th>
                    <th>Column in the RCD</th>
                    <th style={{ textAlign: "right" }}>Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {ACCOUNT_GROUPS.map((g, i) =>
                    periodCols.byGroup[i] ? (
                      <tr key={g.code}>
                        <td className="num">{g.code}</td>
                        <td>{g.name}</td>
                        <td className="amt num">{fmt(periodCols.byGroup[i])}</td>
                      </tr>
                    ) : null,
                  )}
                  <tr>
                    <td colSpan={2}>
                      <b>Total</b>
                    </td>
                    <td className="amt num">
                      <b>{fmt(periodCols.cents)}</b>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="note" style={{ marginTop: 8 }}>
              Account codes show on reports only. They are not on the receipt.
            </p>
          </details>
          <div className="actions" style={{ marginTop: 16 }}>
            <Link className="btn" href="/reports">
              Open reports
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
