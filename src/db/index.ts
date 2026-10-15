import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const globalForDb = globalThis as unknown as { pool?: pg.Pool };

function createPool(): pg.Pool {
  const url = process.env.DATABASE_URL;
  if (!url) {
    // `next build` imports every route to collect page data but never queries. A pool does not
    // connect until it is used, so a placeholder is safe there. At run time the setting is required.
    if (process.env.NEXT_PHASE === "phase-production-build") return new pg.Pool({ connectionString: "postgres://build:build@127.0.0.1:1/build" });
    throw new Error("DATABASE_URL is not set");
  }
  return new pg.Pool({ connectionString: url, max: 10 });
}

export const pool = globalForDb.pool ?? createPool();
if (process.env.NODE_ENV !== "production") globalForDb.pool = pool;

export const db = drizzle(pool, { schema });
export type Db = typeof db;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
export { schema };
