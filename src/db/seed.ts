import "./env";
import { db, pool } from "./index";
import { loadPayors, loadPeople } from "./local-config";
import { seedAll } from "./seed-lib";

async function main() {
  const password = process.env.SEED_PASSWORD;
  if (!password) throw new Error("SEED_PASSWORD is not set");
  const people = loadPeople();
  const payors = loadPayors();
  await seedAll(db, password, { people: people.config, payors: payors.payors });
  const usernames = ["admin", ...people.config.officers.map((o) => o.username)].join(", ");
  console.log(`Seeded reference data and users (${usernames}) from ${people.file}.`);
  if (people.file.endsWith(".example.json")) {
    console.log("These are placeholder names. Copy config/people.example.json to config/people.local.json and fill in your own.");
  }
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
