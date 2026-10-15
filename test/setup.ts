// Point every test at the throwaway r2r_test database, never the working one.
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const file = resolve(process.cwd(), ".env");
const env = existsSync(file) ? readFileSync(file, "utf8") : "";
const m = /^DATABASE_URL=(.*)$/m.exec(env);
const base = process.env.TEST_DATABASE_URL ?? (m ? m[1].trim().replace(/\/[^/]+$/, "/r2r_test") : "");
if (!base) throw new Error("Set TEST_DATABASE_URL or DATABASE_URL in .env");
process.env.DATABASE_URL = base;
process.env.SESSION_SECRET ??= "test-secret-test-secret-test-secret-00";
