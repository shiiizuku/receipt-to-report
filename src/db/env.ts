// Loads .env for scripts run with tsx. Next.js loads it itself.
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const file = resolve(process.cwd(), ".env");
if (existsSync(file)) {
  for (const line of readFileSync(file, "utf8").split(/\r?\n/)) {
    const m = /^([A-Z0-9_]+)=(.*)$/.exec(line.trim());
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
  }
}
