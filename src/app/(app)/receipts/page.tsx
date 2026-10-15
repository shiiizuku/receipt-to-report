import Link from "next/link";
import { fmtDate } from "@/lib/dates";
import { peso } from "@/lib/money";
import { requireUser } from "@/lib/session";
import { getLookups } from "@/services/lookups";
import { listReceipts, type ReceiptFilters } from "@/services/receipts";

export const dynamic = "force-dynamic";
export const metadata = { title: "Receipts" };

type Params = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) || undefined;

export default async function ReceiptsPage({ searchParams }: { searchParams: Promise<Params> }) {
  await requireUser();
  const sp = await searchParams;
  const lookups = await getLookups();
  const filters: ReceiptFilters = {
    from: one(sp.from),
    to: one(sp.to),
    officerId: one(sp.officer) ? Number(one(sp.officer)) : undefined,
    fundId: one(sp.fund) ? Number(one(sp.fund)) : undefined,
    status: (one(sp.status) as ReceiptFilters["status"]) || undefined,
    deposited: (one(sp.deposited) as ReceiptFilters["deposited"]) || undefined,
    q: one(sp.q),
    page: one(sp.page) ? Number(one(sp.page)) : 1,
    pageSize: 25,
  };
  const res = await listReceipts(filters);
  const pages = Math.max(1, Math.ceil(res.total / res.pageSize));
  const qs = (page: number) => {
    const u = new URLSearchParams();
    for (const [k, v] of Object.entries(sp)) if (k !== "page" && typeof v === "string" && v) u.set(k, v);
    u.set("page", String(page));
    return `/receipts?${u.toString()}`;
  };
  const active = ["q", "from", "to", "officer", "fund", "status", "deposited"].filter((k) => one(sp[k])).length;

  return (
    <div className="scr">
      <div className="head">
        <div>
          <p className="eyebrow">Receipts</p>
          <div className="t">All receipts</div>
          <p className="sub">Every official receipt that was issued, including voided ones, so the control numbers always add up.</p>
        </div>
        <Link className="btn" href="/receipts/new">
          New receipt
        </Link>
      </div>

      <form className="card" method="get" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        <div className="filters">
          <div style={{ flex: "2 1 260px" }}>
            <label htmlFor="q">Search payor or OR number</label>
            <input id="q" name="q" defaultValue={one(sp.q)} />
          </div>
          <div>
            <label htmlFor="from">From</label>
            <input id="from" name="from" type="date" defaultValue={one(sp.from)} />
          </div>
          <div>
            <label htmlFor="to">To</label>
            <input id="to" name="to" type="date" defaultValue={one(sp.to)} />
          </div>
        </div>
        <div className="filters">
          <div>
            <label htmlFor="officer">Collecting officer</label>
            <div className="sel">
              <select id="officer" name="officer" defaultValue={one(sp.officer) ?? ""}>
                <option value="">All</option>
                {lookups.officers.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label htmlFor="fund">Fund</label>
            <div className="sel">
              <select id="fund" name="fund" defaultValue={one(sp.fund) ?? ""}>
                <option value="">All</option>
                {lookups.funds.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label htmlFor="status">Status</label>
            <div className="sel">
              <select id="status" name="status" defaultValue={one(sp.status) ?? ""}>
                <option value="">All</option>
                <option value="posted">Posted</option>
                <option value="voided">Voided</option>
              </select>
            </div>
          </div>
          <div>
            <label htmlFor="deposited">Deposit</label>
            <div className="sel">
              <select id="deposited" name="deposited" defaultValue={one(sp.deposited) ?? ""}>
                <option value="">All</option>
                <option value="no">Not yet deposited</option>
                <option value="yes">Deposited</option>
              </select>
            </div>
          </div>
        </div>
        <div className="actions" style={{ justifyContent: "space-between", alignItems: "center" }}>
          <span className="note">{active ? `${active} filter${active === 1 ? "" : "s"} on` : "No filters"}</span>
          <span style={{ display: "flex", gap: 10 }}>
            {active ? (
              <Link className="btn out" href="/receipts">
                Clear
              </Link>
            ) : null}
            <button className="btn" type="submit">
              Apply filters
            </button>
          </span>
        </div>
      </form>

      <div className="tbl scroll">
        <table style={{ minWidth: 860 }}>
          <thead>
            <tr>
              <th>OR no.</th>
              <th>Date</th>
              <th>Payor</th>
              <th>Nature of collection</th>
              <th>Fund</th>
              <th>Mode</th>
              <th style={{ textAlign: "right" }}>Amount</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {res.rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="note" style={{ padding: 24 }}>
                  No receipts match these filters.
                </td>
              </tr>
            ) : null}
            {res.rows.map((r) => (
              <tr key={r.id} className={r.status === "voided" ? "voided" : undefined}>
                <td>
                  <Link className="link sm num" href={`/receipts/${r.id}`}>
                    {r.controlNo}
                  </Link>
                </td>
                <td>{fmtDate(r.date)}</td>
                <td>{r.payor}</td>
                <td>
                  {r.firstNature}
                  {r.lineCount > 1 ? ` +${r.lineCount - 1} more` : ""}
                </td>
                <td>{r.fundName}</td>
                <td>{r.modes.join(" + ")}</td>
                <td className="amt num">{peso(r.totalCents)}</td>
                <td>
                  {r.status === "voided" ? (
                    <span className="pill void">Voided</span>
                  ) : r.depositSlip ? (
                    <span className="pill done">Deposited</span>
                  ) : (
                    <span className="pill move">Posted</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="pager">
        <span className="note">
          {res.total === 0 ? "0 receipts" : `Showing ${(res.page - 1) * res.pageSize + 1}–${Math.min(res.total, res.page * res.pageSize)} of ${res.total.toLocaleString("en-PH")}`}
        </span>
        <span style={{ display: "flex", gap: 10, alignItems: "center" }}>
          {res.page > 1 ? (
            <Link className="btn out" href={qs(res.page - 1)}>
              Previous
            </Link>
          ) : null}
          <span className="note">
            Page {res.page} of {pages}
          </span>
          {res.page < pages ? (
            <Link className="btn out" href={qs(res.page + 1)}>
              Next
            </Link>
          ) : null}
        </span>
      </div>
    </div>
  );
}
