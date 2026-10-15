import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { z } from "zod";

/**
 * Names of real people and the client list are not part of the code. They live in `config/*.local.json`,
 * which git ignores. Without a local file the committed `*.example.json` placeholders are used, so a fresh
 * clone still runs. Copy an example file to `<name>.local.json` and fill it in.
 */
const Officer = z.object({
  name: z.string().min(2),
  title: z.string().nullable().default(null),
  username: z.string().regex(/^[a-z0-9._-]{3,30}$/, "usernames use 3 to 30 lowercase letters, numbers, dots, dashes or underscores"),
  /** The cashier whose name heads the Statement of Deposited Collections. */
  cashier: z.boolean().optional(),
});

const Signatory = z.object({
  key: z.string().min(1),
  report: z.enum(["mrdc", "sdc"]),
  label: z.string(),
  name: z.string(),
  title: z.string(),
  sort: z.number().int(),
});

const Opening = z.object({
  officer: z.string(),
  fund: z.string(),
  asOf: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/),
});

export const PeopleConfig = z.object({
  officers: z.array(Officer).min(1),
  signatories: z.array(Signatory),
  openingBalances: z.array(Opening).default([]),
});
export type PeopleConfig = z.infer<typeof PeopleConfig>;

function read(name: string): { file: string; data: unknown } {
  const dir = resolve(process.cwd(), "config");
  const local = resolve(dir, `${name}.local.json`);
  const file = existsSync(local) ? local : resolve(dir, `${name}.example.json`);
  return { file, data: JSON.parse(readFileSync(file, "utf8")) };
}

export function loadPeople(): { file: string; config: PeopleConfig } {
  const { file, data } = read("people");
  return { file, config: PeopleConfig.parse(data) };
}

export function loadPayors(): { file: string; payors: string[] } {
  const { file, data } = read("payors");
  return { file, payors: z.array(z.string().min(1)).parse(data) };
}
