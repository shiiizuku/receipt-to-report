import { notFound, redirect } from "next/navigation";
import { ReceiptForm, type ActiveBook } from "@/components/ReceiptForm";
import { todayISO } from "@/lib/dates";
import { canActFor, requireUser } from "@/lib/session";
import { listBooks } from "@/services/books";
import { getLookups } from "@/services/lookups";
import { getReceipt } from "@/services/receipts";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return { title: `Edit receipt ${id}` };
}

export default async function EditReceiptPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  if (!/^\d+$/.test(id)) notFound();
  const data = await getReceipt(Number(id));
  if (!data) notFound();
  const { r, lines } = data;
  if (!canActFor(user, r.officerId)) redirect(`/receipts/${r.id}`);

  const [lookups, books] = await Promise.all([getLookups(), listBooks()]);
  const activeBooks: Record<number, ActiveBook | null> = {};
  const officerBooks: Record<number, Array<{ bookNo: number; fromNo: number; toNo: number }>> = {};
  for (const o of lookups.officers) {
    const b = books.find((x) => x.officerId === o.id && x.status === "active");
    activeBooks[o.id] = b ? { bookNo: b.bookNo, fromNo: b.fromNo, toNo: b.toNo, nextNo: b.nextNo, left: b.left } : null;
  }
  for (const b of books) (officerBooks[b.officerId] ??= []).push({ bookNo: b.bookNo, fromNo: b.fromNo, toNo: b.toNo });

  return (
    <div className="scr">
      <div className="head">
        <div>
          <p className="eyebrow">Receipts · Correct</p>
          <div className="t">Edit OR No. {r.controlNo}</div>
          <p className="sub">Changes are saved on the receipt and recorded in the audit trail with what they were before.</p>
        </div>
        {r.status === "voided" ? (
          <span className="pill void">Voided</span>
        ) : (
          <span className={`pill ${r.depositId ? "done" : "move"}`}>{r.depositId ? `Deposited · ${data.depositSlip}` : "Posted"}</span>
        )}
      </div>
      <ReceiptForm
        officers={lookups.officers}
        funds={lookups.funds}
        natures={lookups.natures}
        divisions={lookups.divisions}
        descriptions={lookups.descriptions}
        payors={lookups.payors}
        activeBooks={activeBooks}
        officerBooks={officerBooks}
        lockedOfficerId={user.role === "admin" ? null : user.officerId}
        today={todayISO()}
        edit={{
          id: r.id,
          controlNo: r.controlNo,
          depositSlip: data.depositSlip,
          voidReason: r.status === "voided" ? (r.voidReason ?? "") : null,
          initial: {
            date: r.receiptDate,
            fundId: r.fundId,
            payor: r.payor,
            officerId: r.officerId,
            division: r.division ?? "",
            opNo: r.opNo ?? "",
            modes: r.modes,
            instruments: r.instruments ?? [],
            lines: lines.map((l) => ({ natureId: l.natureId, amount: l.amount, descriptions: l.descriptions })),
          },
        }}
      />
    </div>
  );
}
