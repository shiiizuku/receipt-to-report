import { ReportFilters, SignatoryEditor, type FilterState } from "@/components/ReportControls";
import { ReportView } from "@/components/ReportView";
import { parseYearMonth, todayISO } from "@/lib/dates";
import { requireUser } from "@/lib/session";
import { getLookups } from "@/services/lookups";
import { buildReport, type ReportType } from "@/services/reports/build";

export const dynamic = "force-dynamic";
export const metadata = { title: "Reports" };

type Params = Record<string, string | string[] | undefined>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

export default async function ReportsPage({ searchParams }: { searchParams: Promise<Params> }) {
  const user = await requireUser();
  const sp = await searchParams;
  const lookups = await getLookups();
  const today = todayISO();
  const { year, month } = parseYearMonth(one(sp.month), today);
  const type = (["rcd", "mrdc", "sdc", "rev"].includes(one(sp.type) ?? "") ? one(sp.type) : "rcd") as ReportType;
  const half = (one(sp.half) === "2" ? "2" : one(sp.half) === "1" ? "1" : Number(today.slice(8)) > 15 ? "2" : "1") as "1" | "2";
  const fundId = lookups.funds.some((f) => f.id === Number(one(sp.fund))) ? Number(one(sp.fund)) : lookups.funds[0].id;
  const requested = Number(one(sp.officer));
  const officerId = user.role === "admin" && lookups.officers.some((o) => o.id === requested) ? requested : (user.officerId ?? lookups.officers[0].id);
  const reportNo = (one(sp.no) ?? "").slice(0, 30);

  const model = await buildReport({ type, year, month, half, fundId, officerId, reportNo });
  const state: FilterState = { type, month: `${year}-${String(month).padStart(2, "0")}`, half, fund: fundId, officer: officerId, reportNo };
  const q = new URLSearchParams({ type, month: state.month, half, fund: String(fundId), officer: String(officerId) });
  if (reportNo) q.set("no", reportNo);

  const signatories = model.kind === "mrdc" || model.kind === "sdc" ? model.signatories : [];
  const untitled = model.kind === "rcd" ? lookups.officers.filter((o) => o.id === officerId && !o.title) : [];

  return (
    <div className="scr">
      <div className="head">
        <div>
          <p className="eyebrow">Reports</p>
          <div className="t">Reports</div>
          <p className="sub">Built from posted receipts and deposits. Voided receipts are listed on the RCD as cancelled and never counted.</p>
        </div>
      </div>
      <ReportFilters
        state={state}
        officers={lookups.officers}
        funds={lookups.funds}
        lockedOfficerId={user.role === "admin" ? null : user.officerId}
        exportBase={`/api/reports/export?${q.toString()}`}
      />
      <ReportView model={model} />
      {signatories.length || untitled.length ? (
        <SignatoryEditor signatories={signatories} officersWithoutTitle={untitled} />
      ) : null}
    </div>
  );
}
