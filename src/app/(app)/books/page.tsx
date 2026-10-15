import Link from "next/link";
import { ActivateButton, RegisterBook } from "@/components/BookControls";
import { fmtDate, todayISO } from "@/lib/dates";
import { surname } from "@/lib/text";
import { canActFor, requireUser } from "@/lib/session";
import { listBooks, voidedByBook, type BookRow } from "@/services/books";
import { getLookups } from "@/services/lookups";

export const dynamic = "force-dynamic";
export const metadata = { title: "OR books" };

const STATUS: Record<BookRow["status"], [string, string]> = {
  active: ["move", "Active"],
  "in-stock": ["wait", "In stock"],
  "on-hold": ["closed", "On hold"],
  exhausted: ["done", "Exhausted"],
};

const Pill = ({ s }: { s: BookRow["status"] }) => <span className={`pill ${STATUS[s][0]}`}>{STATUS[s][1]}</span>;
const last = surname;

export default async function BooksPage({ searchParams }: { searchParams: Promise<{ book?: string }> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const [books, lookups, voided] = await Promise.all([listBooks(), getLookups(), voidedByBook()]);
  const sel = books.find((b) => String(b.bookNo) === sp.book) ?? books.find((b) => b.status === "active") ?? books[0];
  const stock = books.filter((b) => b.status === "in-stock");
  const left = books.reduce((a, b) => a + b.left, 0);
  const highest = books.reduce((a, b) => Math.max(a, b.toNo), 0);

  return (
    <div className="scr">
      <div className="head">
        <div>
          <p className="eyebrow">Accountable forms · Form No. 51-C</p>
          <div className="t">Official receipt books</div>
          <p className="sub">Every control number you can issue, by book and collecting officer. The next receipt takes the next number in that officer&apos;s active book.</p>
        </div>
        <RegisterBook officers={lookups.officers} lockedOfficerId={user.role === "admin" ? null : user.officerId} suggestedFrom={highest + 1 || 1} today={todayISO()} />
      </div>

      <div className="tiles">
        <div className="tile">
          <span className="l">Active books</span>
          <span className="v">
            {lookups.officers.filter((o) => books.some((b) => b.officerId === o.id && b.status === "active")).length} of {lookups.officers.length}
          </span>
          <span className="note">
            {lookups.officers.map((o) => {
              const b = books.find((x) => x.officerId === o.id && x.status === "active");
              return (
                <span key={o.id} style={{ display: "block" }}>
                  {last(o.name)}: {b ? `Book ${b.bookNo}, ${b.left} left` : "none active"}
                </span>
              );
            })}
          </span>
        </div>
        <div className="tile">
          <span className="l">Books in stock</span>
          <span className="v">{stock.length}</span>
          <span className="note">{stock.reduce((a, b) => a + b.left, 0)} control numbers unissued</span>
        </div>
        <div className="tile">
          <span className="l">Control numbers left</span>
          <span className="v">{left.toLocaleString("en-PH")}</span>
          <span className="note">Across all books</span>
        </div>
      </div>

      <div className="grid2" style={{ gridTemplateColumns: "minmax(0,1.5fr) minmax(0,1fr)" }}>
        <div className="tbl scroll">
          <table style={{ minWidth: 860 }}>
            <thead>
              <tr>
                <th>Book</th>
                <th>Issued to</th>
                <th>Control numbers</th>
                <th>Next number</th>
                <th style={{ textAlign: "right" }}>Issued</th>
                <th style={{ textAlign: "right" }}>Left</th>
                <th style={{ textAlign: "right" }}>Unaccounted</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {books.length === 0 ? (
                <tr>
                  <td colSpan={8} className="note" style={{ padding: 24 }}>
                    No books yet. Register the first book you were issued.
                  </td>
                </tr>
              ) : null}
              {books.map((b) => (
                <tr key={b.id} className={b.id === sel?.id ? "sel" : undefined}>
                  <td>
                    <Link className="link" href={`/books?book=${b.bookNo}`} aria-current={b.id === sel?.id ? "true" : undefined}>
                      Book {b.bookNo}
                    </Link>
                  </td>
                  <td>{last(b.officerName)}</td>
                  <td className="num">
                    {b.fromNo}–{b.toNo}
                  </td>
                  <td className="num">{b.status === "exhausted" ? "—" : b.nextNo}</td>
                  <td className="amt num">{b.issued}</td>
                  <td className="amt num">{b.left}</td>
                  <td className="amt num">{b.gaps.length ? <span className="pill wait">{b.gaps.length}</span> : 0}</td>
                  <td>
                    <Pill s={b.status} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {sel ? (
          <div className="card">
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8, flexWrap: "wrap" }}>
              <div>
                <p className="eyebrow">Accountable Form No. 51-C</p>
                <h3>Book {sel.bookNo}</h3>
              </div>
              <Pill s={sel.status} />
            </div>
            <p className="num" style={{ marginTop: 10, fontSize: 18 }}>
              {sel.fromNo}–{sel.toNo}
            </p>
            <div className="bar" style={{ margin: "12px 0 6px" }} role="img" aria-label={`${sel.issued} of ${sel.toNo - sel.fromNo + 1} control numbers issued`}>
              <i style={{ width: `${(sel.issued / (sel.toNo - sel.fromNo + 1)) * 100}%` }} />
            </div>
            <p className="note">
              {sel.issued} of {sel.toNo - sel.fromNo + 1} issued
            </p>
            <div style={{ marginTop: 8 }}>
              <div className="kv"><span>Issued</span><span>{sel.issued}</span></div>
              <div className="kv"><span>Voided</span><span>{(voided.get(sel.id) ?? []).length}</span></div>
              <div className="kv"><span>Left</span><span>{sel.left}</span></div>
              <div className="kv"><span>Next control number</span><span className="num">{sel.status === "exhausted" ? "—" : sel.nextNo}</span></div>
              <div className="kv"><span>Issued to</span><span>{sel.officerName}</span></div>
              <div className="kv"><span>Date received</span><span>{fmtDate(sel.receivedOn)}</span></div>
            </div>
            <span className="lbl" style={{ marginTop: 14 }}>Voided numbers</span>
            {(voided.get(sel.id) ?? []).length ? (
              <div className="chips">
                {(voided.get(sel.id) ?? []).map((n) => (
                  <span className="chip num" key={n}>{n}</span>
                ))}
              </div>
            ) : (
              <p className="note">None</p>
            )}
            <span className="lbl" style={{ marginTop: 14 }}>Unaccounted numbers</span>
            {sel.gaps.length ? (
              <>
                <div className="chips">
                  {sel.gaps.slice(0, 60).map((n) => (
                    <span className="chip num" key={n}>{n}</span>
                  ))}
                  {sel.gaps.length > 60 ? <span className="note">and {sel.gaps.length - 60} more</span> : null}
                </div>
                <p className="note" style={{ marginTop: 6 }}>
                  Numbers below the next one that no receipt uses: skipped, or moved by an edit. Use one by typing it as the OR number on a new receipt, or move a receipt to it. Each must be a receipt or a voided receipt to be accounted for.
                </p>
              </>
            ) : (
              <p className="note">None</p>
            )}
            {sel.status !== "active" && sel.status !== "exhausted" && canActFor(user, sel.officerId) ? (
              <div className="actions" style={{ marginTop: 16 }}>
                <ActivateButton bookId={sel.id} label={`Set as active for ${last(sel.officerName)}`} />
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
