/**
 * Pure report calculations. They take plain rows and return plain structures, so the same
 * numbers feed the screen, the Excel export and the PDF export.
 */

export interface RLine {
  nature: string;
  /** Index into ACCOUNT_GROUPS (the RCD account-code column). */
  group: number;
  cents: number;
  descriptions: string[];
}

export interface RReceipt {
  controlNo: number;
  date: string; // YYYY-MM-DD
  payor: string;
  officerId: number;
  fundId: number;
  division: string | null;
  opNo: string | null;
  modes: string[];
  depositId: number | null;
  status: "posted" | "voided";
  lines: RLine[];
  totalCents: number;
}

export interface RDeposit {
  id: number;
  slipNo: string;
  date: string;
  officerId: number;
  bankMsgNo: string | null;
}

export interface ROpening {
  officerId: number;
  fundId: number;
  cents: number;
}

export const GROUP_COUNT = 6;
export const isCash = (r: RReceipt) => r.modes.length === 1 && r.modes[0] === "Cash";
const posted = (r: RReceipt) => r.status === "posted";
const sumCents = (rs: RReceipt[]) => rs.filter(posted).reduce((a, r) => a + r.totalCents, 0);
const byDateThenNo = (a: RReceipt, b: RReceipt) =>
  a.date < b.date ? -1 : a.date > b.date ? 1 : a.controlNo - b.controlNo;

/**
 * Split receipts into one group per deposit slip, then the receipts not yet deposited. A voided receipt has
 * no deposit, but it is not set apart: it stays with its neighbours by OR number, so the series reads in order.
 */
function groupByDeposit(rs: RReceipt[], deposits: RDeposit[]): Array<{ deposit: RDeposit | null; receipts: RReceipt[] }> {
  const live = rs.filter(posted);
  const groups: Array<{ deposit: RDeposit | null; receipts: RReceipt[] }> = [];
  for (const d of deposits) {
    const g = live.filter((r) => r.depositId === d.id);
    if (g.length) groups.push({ deposit: d, receipts: g });
  }
  const open = live.filter((r) => !r.depositId);
  if (open.length) groups.push({ deposit: null, receipts: open });

  const groupOf = (r: RReceipt) => groups.findIndex((g) => (r.depositId ? g.deposit?.id === r.depositId : g.deposit === null));
  const byNo = [...live].sort((a, b) => a.controlNo - b.controlNo);
  for (const v of rs.filter((r) => !posted(r))) {
    const before = [...byNo].reverse().find((r) => r.controlNo < v.controlNo);
    const after = byNo.find((r) => r.controlNo > v.controlNo);
    const near = before ?? after;
    let idx = near ? groupOf(near) : -1;
    if (idx < 0) {
      groups.push({ deposit: null, receipts: [] });
      idx = groups.length - 1;
    }
    groups[idx].receipts.push(v);
  }
  for (const g of groups) g.receipts.sort(byDateThenNo);
  return groups;
}

export function columnTotals(rs: RReceipt[]): { byGroup: number[]; cents: number } {
  const byGroup = Array.from({ length: GROUP_COUNT }, () => 0);
  let cents = 0;
  for (const r of rs.filter(posted)) {
    for (const l of r.lines) {
      byGroup[l.group] += l.cents;
      cents += l.cents;
    }
  }
  return { byGroup, cents };
}

/** Collections not yet deposited as of the start of a period. */
export function balanceForward(
  receipts: RReceipt[],
  deposits: RDeposit[],
  openings: ROpening[],
  officerId: number,
  fundId: number | null,
  before: string,
): number {
  let bal = openings
    .filter((o) => o.officerId === officerId && (fundId === null || o.fundId === fundId))
    .reduce((a, o) => a + o.cents, 0);
  const depDate = new Map(deposits.map((d) => [d.id, d.date]));
  for (const r of receipts) {
    if (!posted(r) || r.officerId !== officerId || (fundId !== null && r.fundId !== fundId)) continue;
    if (r.date < before) bal += r.totalCents;
    const dd = r.depositId ? depDate.get(r.depositId) : undefined;
    if (dd && dd < before) bal -= r.totalCents;
  }
  return bal;
}

export interface RcdGroup {
  /** null for receipts that are not on any deposit yet. */
  deposit: RDeposit | null;
  receipts: RReceipt[];
  subtotal: { byGroup: number[]; cents: number };
}

export interface RcdResult {
  balanceForward: number;
  groups: RcdGroup[];
  total: { byGroup: number[]; cents: number };
  depositsCents: number;
  undepositedCents: number;
  orFrom: number | null;
  orTo: number | null;
}

export function rcd(input: {
  receipts: RReceipt[];
  deposits: RDeposit[];
  openings: ROpening[];
  officerId: number;
  fundId: number;
  from: string;
  to: string;
}): RcdResult {
  const { officerId, fundId, from, to } = input;
  const rs = input.receipts
    .filter((r) => r.officerId === officerId && r.fundId === fundId && r.date >= from && r.date <= to)
    .sort(byDateThenNo);
  const mine = input.deposits.filter((d) => d.officerId === officerId).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.id - b.id));
  const groups: RcdGroup[] = groupByDeposit(rs, mine).map((g) => ({ ...g, subtotal: columnTotals(g.receipts) }));

  const bf = balanceForward(input.receipts, input.deposits, input.openings, officerId, fundId, from);
  const total = columnTotals(rs);
  let depositsCents = 0;
  for (const d of mine) {
    if (d.date < from || d.date > to) continue;
    depositsCents += sumCents(input.receipts.filter((r) => r.depositId === d.id && r.fundId === fundId));
  }
  const nos = rs.map((r) => r.controlNo);
  return {
    balanceForward: bf,
    groups,
    total,
    depositsCents,
    undepositedCents: bf + total.cents - depositsCents,
    orFrom: nos.length ? Math.min(...nos) : null,
    orTo: nos.length ? Math.max(...nos) : null,
  };
}

export interface MrdcRow {
  collectionDate: string;
  orFrom: number;
  orTo: number;
  collectedCents: number;
  deposit: { date: string; slipNo: string; cents: number } | null;
  cashOnHandCents: number;
}

export interface MrdcResult {
  beginning: number;
  rows: MrdcRow[];
  collectionsCents: number;
  depositedCents: number;
  /** Deposits dated in the month, including those for earlier months' collections. */
  depositsForMonth: number;
  ending: number;
}

export function mrdc(input: {
  receipts: RReceipt[];
  deposits: RDeposit[];
  openings: ROpening[];
  officerId: number;
  from: string;
  to: string;
}): MrdcResult {
  const { officerId, from, to } = input;
  const rs = input.receipts
    .filter((r) => r.officerId === officerId && r.date >= from && r.date <= to)
    .sort(byDateThenNo);
  const beginning = balanceForward(input.receipts, input.deposits, input.openings, officerId, null, from);
  const mine = input.deposits.filter((d) => d.officerId === officerId).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.id - b.id));

  const groups = groupByDeposit(rs, mine);

  let running = beginning;
  let collections = 0;
  let deposited = 0;
  const rows: MrdcRow[] = groups.map(({ deposit, receipts }) => {
    const nos = receipts.map((r) => r.controlNo);
    const collected = sumCents(receipts);
    const depCents = deposit ? sumCents(input.receipts.filter((r) => r.depositId === deposit.id)) : 0;
    collections += collected;
    deposited += depCents;
    running += collected - depCents;
    return {
      collectionDate: receipts[receipts.length - 1].date,
      orFrom: Math.min(...nos),
      orTo: Math.max(...nos),
      collectedCents: collected,
      deposit: deposit ? { date: deposit.date, slipNo: deposit.slipNo, cents: depCents } : null,
      cashOnHandCents: running,
    };
  });
  let depositsForMonth = 0;
  for (const d of mine) {
    if (d.date >= from && d.date <= to) depositsForMonth += sumCents(input.receipts.filter((r) => r.depositId === d.id));
  }
  return {
    beginning,
    rows,
    collectionsCents: collections,
    depositedCents: deposited,
    depositsForMonth,
    ending: beginning + collections - depositsForMonth,
  };
}

export interface SdcRow {
  date: string;
  slipNo: string;
  cashCents: number;
  checkCents: number;
  bankMsgNo: string | null;
  totalCents: number;
}

export function sdc(input: { receipts: RReceipt[]; deposits: RDeposit[]; from: string; to: string }) {
  const rows: SdcRow[] = input.deposits
    .filter((d) => d.date >= input.from && d.date <= input.to)
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.id - b.id))
    .map((d) => {
      const rs = input.receipts.filter((r) => r.depositId === d.id && posted(r));
      const cash = sumCents(rs.filter(isCash));
      const total = sumCents(rs);
      return { date: d.date, slipNo: d.slipNo, cashCents: cash, checkCents: total - cash, bankMsgNo: d.bankMsgNo, totalCents: total };
    });
  const cash = rows.reduce((a, r) => a + r.cashCents, 0);
  const check = rows.reduce((a, r) => a + r.checkCents, 0);
  const validated = rows.filter((r) => r.bankMsgNo).reduce((a, r) => a + r.totalCents, 0);
  return { rows, cashCents: cash, checkCents: check, totalCents: cash + check, validatedCents: validated, inTransitCents: cash + check - validated };
}

export interface RevenueGroup {
  group: number;
  items: Array<{ nature: string; count: number; cents: number }>;
  subtotalCents: number;
}

export function revenue(input: { receipts: RReceipt[]; from: string; to: string }): { groups: RevenueGroup[]; totalCents: number } {
  const agg = new Map<string, { group: number; count: number; cents: number }>();
  let total = 0;
  for (const r of input.receipts) {
    if (!posted(r) || r.date < input.from || r.date > input.to) continue;
    for (const l of r.lines) {
      const a = agg.get(l.nature) ?? { group: l.group, count: 0, cents: 0 };
      a.count += 1;
      a.cents += l.cents;
      agg.set(l.nature, a);
      total += l.cents;
    }
  }
  const groups: RevenueGroup[] = [];
  for (let g = 0; g < GROUP_COUNT; g++) {
    const items = [...agg.entries()]
      .filter(([, v]) => v.group === g)
      .map(([nature, v]) => ({ nature, count: v.count, cents: v.cents }))
      .sort((a, b) => a.nature.localeCompare(b.nature));
    if (items.length) groups.push({ group: g, items, subtotalCents: items.reduce((a, i) => a + i.cents, 0) });
  }
  return { groups, totalCents: total };
}
