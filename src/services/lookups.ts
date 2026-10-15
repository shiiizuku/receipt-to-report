import { asc } from "drizzle-orm";
import { db as defaultDb, schema, type Db } from "@/db";

export interface Lookups {
  officers: Array<{ id: number; name: string; title: string | null }>;
  funds: Array<{ id: number; code: string; name: string }>;
  natures: Array<{ id: number; name: string }>;
  divisions: Array<{ code: string; rccCode: string | null; noOpNumber: boolean }>;
  descriptions: string[];
  payors: string[];
}

export async function getLookups(db: Db = defaultDb): Promise<Lookups> {
  const [officers, funds, natures, divisions, descriptions, payors] = await Promise.all([
    db.select().from(schema.officers).orderBy(asc(schema.officers.id)),
    db.select().from(schema.funds).orderBy(asc(schema.funds.sort)),
    db.select({ id: schema.natures.id, name: schema.natures.name }).from(schema.natures).orderBy(asc(schema.natures.name)),
    db.select().from(schema.divisions).orderBy(asc(schema.divisions.sort)),
    db.select({ text: schema.descriptions.text }).from(schema.descriptions).orderBy(asc(schema.descriptions.text)),
    db.select({ name: schema.payors.name }).from(schema.payors).orderBy(asc(schema.payors.name)),
  ]);
  return {
    officers,
    funds,
    natures,
    divisions,
    descriptions: descriptions.map((d) => d.text),
    payors: payors.map((p) => p.name),
  };
}
