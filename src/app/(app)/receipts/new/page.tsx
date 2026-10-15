import { ReceiptForm, type ActiveBook } from "@/components/ReceiptForm";
import { todayISO } from "@/lib/dates";
import { requireUser } from "@/lib/session";
import { listBooks } from "@/services/books";
import { getLookups } from "@/services/lookups";

export const dynamic = "force-dynamic";
export const metadata = { title: "New receipt" };

export default async function NewReceiptPage() {
  const user = await requireUser();
  const [lookups, books] = await Promise.all([getLookups(), listBooks()]);
  const activeBooks: Record<number, ActiveBook | null> = {};
  for (const o of lookups.officers) {
    const b = books.find((x) => x.officerId === o.id && x.status === "active");
    activeBooks[o.id] = b ? { bookNo: b.bookNo, fromNo: b.fromNo, toNo: b.toNo, nextNo: b.nextNo, left: b.left } : null;
  }
  const officerBooks: Record<number, Array<{ bookNo: number; fromNo: number; toNo: number }>> = {};
  for (const b of books) (officerBooks[b.officerId] ??= []).push({ bookNo: b.bookNo, fromNo: b.fromNo, toNo: b.toNo });
  return (
    <div className="scr">
      <div className="head">
        <div>
          <p className="eyebrow">Receipts · New</p>
          <div className="t">Official receipt</div>
          <p className="sub">Laid out like Accountable Form No. 51-C. The control number comes from the collecting officer&apos;s active book.</p>
        </div>
        <span className="pill wait">Draft</span>
      </div>
      <ReceiptForm
        officers={lookups.officers}
        funds={lookups.funds}
        natures={lookups.natures}
        divisions={lookups.divisions}
        descriptions={lookups.descriptions}
        payors={lookups.payors}
        activeBooks={activeBooks}
        lockedOfficerId={user.role === "admin" ? null : user.officerId}
        today={todayISO()}
        officerBooks={officerBooks}
      />
    </div>
  );
}
