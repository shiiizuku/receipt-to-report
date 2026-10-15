/**
 * Optional sample data so a fresh install has something to look at. Run with `npm run db:demo`.
 * It refuses to run if any OR book already exists. Names and amounts are made up.
 */
import "./env";
import { eq } from "drizzle-orm";
import { todayISO } from "../lib/dates";
import { registerBook } from "../services/books";
import { recordDeposit, validateDeposit } from "../services/deposits";
import { postReceipt } from "../services/receipts";
import { db, pool, schema } from "./index";

type Mode = "Cash" | "Check";

async function main() {
  const existing = await db.select().from(schema.orBooks).limit(1);
  if (existing.length) throw new Error("OR books already exist. The demo only runs on an empty ledger.");

  const officers = await db.select().from(schema.officers);
  const funds = await db.select().from(schema.funds);
  const natures = await db.select().from(schema.natures);
  const sorted = [...officers].sort((a, b) => a.id - b.id);
  if (sorted.length < 2) throw new Error("The demo needs two collecting officers. Add a second one in config/people.local.json and seed again.");
  const officer1 = sorted[0].id;
  const officer2 = sorted[1].id;
  const f101 = funds.find((f) => f.code === "101")!.id;
  const f151 = funds.find((f) => f.code === "151")!.id;
  const nat = (n: string) => natures.find((x) => x.name === n)!.id;
  const today = todayISO();

  await registerBook({ fromNo: 7378451, toNo: 7378500, officerId: officer2, receivedOn: "2026-07-21" }, null, db);
  await registerBook({ fromNo: 7378527, toNo: 7378576, officerId: officer1, receivedOn: "2026-09-08" }, null, db);
  await registerBook({ fromNo: 7378601, toNo: 7378650, officerId: officer1, receivedOn: "2026-10-05" }, null, db);
  await registerBook({ fromNo: 7378651, toNo: 7378700, officerId: officer2, receivedOn: "2026-10-05" }, null, db);

  const make = (officerId: number, fundId: number, date: string, payor: string, division: string, op: string, modes: Mode[], lines: Array<[string, string, string[]?]>) =>
    postReceipt(
      {
        date, payor, officerId, fundId, division, opNo: op, modes,
        instruments: modes.includes("Check") ? [{ kind: "Check", bank: "Example Bank", number: "0034871", date }] : [],
        lines: lines.map(([n, a, d]) => ({ natureId: nat(n), amount: a, descriptions: d ?? [] })),
      },
      null,
      db,
    );

  const j: number[] = [];
  const push = async (p: ReturnType<typeof make>) => j.push((await p).id);
  await push(make(officer1, f101, "2026-10-01", "Bagong Pag-asa Mining Corp.", "MTES", "202610003", ["Cash"], [["APPLICATION FEE", "2000", ["OTP - LIMESTONE"]]]));
  await push(make(officer1, f101, "2026-10-01", "Bagong Pag-asa Mining Corp.", "MTES", "202610004", ["Cash"], [["VERIFICATION FEE", "8000", ["OTP"]]]));
  await push(make(officer1, f101, "2026-10-02", "Sierra Aggregates Inc.", "MTES", "202610005", ["Cash"], [["REGISTRATION FEE", "1000", ["SECRETARY'S CERTIFICATE"]]]));
  await push(make(officer1, f101, "2026-10-02", "R. Mendoza", "GD", "202610006", ["Cash"], [["GEOHAZARD IDENTIFICATION", "6000", ["PROPOSED SUBDIVISION"]]]));
  await push(make(officer1, f101, "2026-10-06", "Cabalen Quarry Corp.", "MSESDD", "202610007", ["Check"], [["INSPECTION FEE", "8000", ["MECHANICAL & ELECTRICAL INSTALLATION"]]]));
  await push(make(officer1, f101, "2026-10-06", "Cabalen Quarry Corp.", "MSESDD", "202610008", ["Check"], [["FINES AND PENALTIES", "10000", ["SHE'S PENALTY COVERING CY 2025"]]]));
  await push(make(officer1, f101, "2026-10-07", "A. Villanueva", "FAD", "202610009", ["Cash"], [["CERTIFICATION FEE", "50", ["AREA STATUS / CLEARANCE"]]]));
  await push(make(officer1, f101, "2026-10-08", "Tarlac Cement Corp.", "MTES", "202610010", ["Check"], [["FILING FEE", "200000", ["EXPA"]]]));
  await push(make(officer1, f101, "2026-10-09", "Tarlac Cement Corp.", "MTES", "202610011", ["Check"], [["REGISTRATION FEE", "1000", ["BOARD RESOLUTION"]]]));
  await recordDeposit({ officerId: officer1, receiptIds: j.slice(0, 4), slipNo: "2026-129", date: "2026-10-05" }, null, db);
  await recordDeposit({ officerId: officer1, receiptIds: j.slice(4, 7), slipNo: "2026-130", date: "2026-10-09" }, null, db);
  const deps = await db.select().from(schema.deposits);
  for (const d of deps) await validateDeposit(d.id, `LBP-DEMO-${d.id}`, null, db);

  await make(officer2, f151, "2026-10-02", "Orion Sand & Gravel", "GD", "202610001", ["Cash"], [["GEOLOGICAL INVESTIGATION", "6000", ["PROPOSED QUARRY"]]]);
  await make(officer1, f101, today, "Santos Mining Corp.", "MTES", "202610101", ["Check"], [["ROYALTY FEE", "182400", ["90% OF 5% INCOME"]]]);
  await make(officer1, f101, today, "Lopez Construction", "MTES", "202610102", ["Cash"], [["APPLICATION FEE", "3500", ["ORE TRANSPORT PERMIT"]]]);
  await make(officer2, f151, today, "Rivera Resources", "MSESDD", "202610103", ["Check"], [["FINES AND PENALTIES", "96750.50", ["EXPA"]]]);
  await make(officer1, f101, today, "Dela Cruz Aggregates Inc.", "MSESDD", "202610106", ["Cash"], [["INSPECTION FEE", "2000"], ["CERTIFIED TRUE COPY", "300"]]);

  const [officer] = await db.select().from(schema.officers).where(eq(schema.officers.id, officer1));
  console.log(`Demo data loaded for ${officer.name} and ${sorted[1].name}.`);
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
