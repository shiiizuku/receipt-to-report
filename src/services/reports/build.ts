import { asc, desc } from "drizzle-orm";
import { db as defaultDb, schema, type Db } from "@/db";
import { ACCOUNT_GROUPS, ADDRESS, DEPOSITORY_BANK, ENTITY_NAME, RCC_CODE } from "@/lib/constants";
import { halfBounds, monthBounds, monthName } from "@/lib/dates";
import { loadReportData, loadSignatories } from "../report-data";
import { mrdc, rcd, revenue, sdc, type MrdcResult, type RcdResult, type RReceipt } from "./compute";

export type ReportType = "rcd" | "mrdc" | "sdc" | "rev";

export interface ReportParams {
  type: ReportType;
  year: number;
  month: number;
  half: "1" | "2";
  fundId?: number;
  officerId?: number;
  reportNo?: string;
}

export interface Signatory {
  key: string;
  label: string;
  name: string;
  title: string;
}

export interface RcdModel {
  kind: "rcd";
  title: string;
  periodLabel: string;
  entityName: string;
  fundCluster: string;
  reportNo: string;
  rcc: string;
  officer: { name: string; title: string | null };
  result: RcdResult;
  divisionCodes: Record<string, string | null>;
  groups: Array<{ code: string; name: string }>;
}

export interface MrdcModel {
  kind: "mrdc";
  title: string;
  periodLabel: string;
  agency: string;
  address: string;
  officerName: string;
  result: MrdcResult;
  signatories: Signatory[];
}

export interface SdcModel {
  kind: "sdc";
  title: string;
  periodLabel: string;
  cashier: { name: string; title: string };
  agency: string;
  bank: string;
  result: ReturnType<typeof sdc>;
  signatories: Signatory[];
}

export interface RevModel {
  kind: "rev";
  title: string;
  periodLabel: string;
  result: ReturnType<typeof revenue>;
  groups: Array<{ code: string; name: string }>;
}

export type ReportModel = RcdModel | MrdcModel | SdcModel | RevModel;

const GROUPS = ACCOUNT_GROUPS.map((g) => ({ code: g.code, name: g.name }));

export async function buildReport(p: ReportParams, db: Db = defaultDb): Promise<ReportModel> {
  const month = monthBounds(p.year, p.month);
  const monthLabel = `${monthName(p.month).toUpperCase()} ${p.year}`;

  if (p.type === "rcd") {
    const half = halfBounds(p.year, p.month, p.half);
    const data = await loadReportData(half.to, db);
    const officers = await db.select().from(schema.officers);
    const funds = await db.select().from(schema.funds);
    const officer = officers.find((o) => o.id === p.officerId) ?? officers[0];
    const fund = funds.find((f) => f.id === p.fundId) ?? funds[0];
    const divs = await db.select().from(schema.divisions);
    const result = rcd({ ...data, officerId: officer.id, fundId: fund.id, from: half.from, to: half.to });
    return {
      kind: "rcd",
      title: "REPORT OF COLLECTIONS AND DEPOSITS",
      periodLabel: half.label,
      entityName: ENTITY_NAME,
      fundCluster: fund.clusterLabel ?? fund.name,
      reportNo: p.reportNo ?? "",
      rcc: RCC_CODE,
      officer: { name: officer.name, title: officer.title },
      result,
      divisionCodes: Object.fromEntries(divs.map((d) => [d.code, d.rccCode])),
      groups: GROUPS,
    };
  }

  const data = await loadReportData(month.to, db);

  if (p.type === "mrdc") {
    const officers = await db.select().from(schema.officers);
    const officer = officers.find((o) => o.id === p.officerId) ?? officers[0];
    return {
      kind: "mrdc",
      title: "MONTHLY REPORT OF COLLECTIONS AND DEPOSITS",
      periodLabel: monthLabel,
      agency: "Mines and Geosciences Bureau RIII",
      address: ADDRESS,
      officerName: officer.name,
      result: mrdc({ ...data, officerId: officer.id, from: month.from, to: month.to }),
      signatories: await loadSignatories("mrdc", db),
    };
  }

  if (p.type === "sdc") {
    const [cashier] = await db.select().from(schema.officers).orderBy(desc(schema.officers.isCashier), asc(schema.officers.id)).limit(1);
    return {
      kind: "sdc",
      title: "STATEMENT OF DEPOSITED COLLECTIONS ALL FUND",
      periodLabel: `For the Month of ${monthName(p.month)} ${month.from.slice(8)}–${month.to.slice(8)} ${p.year}`,
      cashier: { name: cashier?.name ?? "", title: (cashier?.title ?? "").toUpperCase() },
      agency: "MINES AND GEOSCIENCES BUREAU RIII",
      bank: DEPOSITORY_BANK.toUpperCase(),
      result: sdc({ receipts: data.receipts, deposits: data.deposits, from: month.from, to: month.to }),
      signatories: await loadSignatories("sdc", db),
    };
  }

  return {
    kind: "rev",
    title: "MONTHLY REVENUE COLLECTION REPORT",
    periodLabel: monthLabel,
    result: revenue({ receipts: data.receipts, from: month.from, to: month.to }),
    groups: GROUPS,
  };
}

export type { RReceipt };
