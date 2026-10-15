import { NextResponse, type NextRequest } from "next/server";
import { parseYearMonth, todayISO } from "@/lib/dates";
import { getSession } from "@/lib/session";
import { buildWorkbook } from "@/services/exports/excel";
import { buildPdf } from "@/services/exports/pdf";
import { audit } from "@/services/audit";
import { db } from "@/db";
import { getLookups } from "@/services/lookups";
import { buildReport, type ReportType } from "@/services/reports/build";

export const dynamic = "force-dynamic";

const NAMES: Record<ReportType, string> = {
  rcd: "Report of Collection & Deposit",
  mrdc: "Monthly Report of Collections and Deposits",
  sdc: "Statement of Deposited Collections",
  rev: "Monthly Revenue Collection Report",
};

export async function GET(req: NextRequest) {
  const user = await getSession();
  if (!user) return NextResponse.json({ error: "Sign in first." }, { status: 401 });
  if (user.mustChangePassword) return NextResponse.json({ error: "Choose a new password first." }, { status: 403 });

  const q = req.nextUrl.searchParams;
  const type = q.get("type") as ReportType;
  if (!(type in NAMES)) return NextResponse.json({ error: "Unknown report." }, { status: 400 });
  const format = q.get("format") === "pdf" ? "pdf" : "xlsx";
  const { year, month } = parseYearMonth(q.get("month") ?? undefined, todayISO());
  const half = q.get("half") === "2" ? "2" : "1";

  const lookups = await getLookups();
  const fundId = lookups.funds.some((f) => f.id === Number(q.get("fund"))) ? Number(q.get("fund")) : lookups.funds[0].id;
  const requested = Number(q.get("officer"));
  const officerId = user.role === "admin" && lookups.officers.some((o) => o.id === requested) ? requested : (user.officerId ?? lookups.officers[0].id);

  const model = await buildReport({ type, year, month, half, fundId, officerId, reportNo: (q.get("no") ?? "").slice(0, 30) });
  const body = format === "pdf" ? await buildPdf(model) : await buildWorkbook(model);
  await audit(db, user.id, "report.export", "report", type, { format, year, month, half, fundId, officerId });

  const period = type === "rcd" ? `${year}-${String(month).padStart(2, "0")} ${half === "1" ? "1-15" : "16-end"}` : `${year}-${String(month).padStart(2, "0")}`;
  const filename = `${NAMES[type]} ${period}.${format}`;
  return new NextResponse(new Uint8Array(body), {
    headers: {
      "Content-Type": format === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename.replace(/[^\w .&-]/g, "")}"`,
      "Cache-Control": "no-store",
    },
  });
}
