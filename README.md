# Receipt-to-Report

Enter each Official Receipt (Accountable Form No. 51-C) once. Deposits and the collection reports are built from it, so nothing is retyped between sheets.

Built for Mines and Geosciences Bureau Region III. The agency name is fixed on every receipt.

## What it does

| Screen | What you do there |
|---|---|
| **Today** | Collected today, undeposited collections, OR book levels, and the running RCD for the current half-month. |
| **New receipt** | The 51-C form. Up to 8 natures of collection, each with up to 2 description lines. Fund, payor, mode of payment (cash, check, money order with drawee bank, number and date), division and order-of-payment number for the reports. The control number comes from the collecting officer's active book. |
| **Receipts** | Search and filter every receipt, including voided ones. Open one to see it as printed, or void it with a reason. |
| **OR books** | Register each book's control-number range per collecting officer. Overlapping ranges are refused. Each officer has one active book. When a book runs out the next unopened one becomes active. |
| **Deposits** | Select receipts for a deposit slip, record it, then enter the bank message number once validated. An unvalidated deposit can be removed. |
| **Reports** | RCD (1–15 and 16–end), Monthly RCD, Statement of Deposited Collections, and Monthly Revenue. Each exports to Excel and PDF. |

Account codes are not on the receipt. They appear on reports, taken from the six columns of your RCD (Permit fees 4020101000, Supervision & Regulation Enforcement fee 4020107000, Miscellaneous Income 4060999000, Share from National Wealth 4040101000, Other Services Income 4020199000, Refund / Others 1990104000). The nature-to-column placement is in `src/lib/constants.ts`; it was inferred from the October 2026 RCD, so check it.

## Names and client lists stay out of the repo

The names of real people, and the list of client names for the payor field, are not in the code. They live in two files that git ignores:

| File | Holds |
|---|---|
| `config/people.local.json` | The collecting officers (name, title, username, which one is the cashier), the default names printed at the foot of the Monthly RCD and the Deposited Collections report, and any opening balance carried from the last report. |
| `config/payors.local.json` | The client names that the payor field suggests. |

Without those files the seed uses `config/people.example.json` and `config/payors.example.json`, which hold placeholder names, so a fresh clone still runs. To use your own, copy each `.example.json` to `.local.json` and edit it, then run `npm run db:seed`. Seeding only adds what is missing, so it never overwrites names you have since edited in the app.

## Appearance

Everyone can set their own look, remembered per browser:

- **Colour mode:** the sun/moon button switches light and dark. The palette popover also has Light, Dark and System (follow the computer).
- **Themes:** the palette button opens eight themes from the Civic Ledger design: Neutral pastel (default), Stone grey, Slate grey, Cool mist, Warm sand, Sage pastel, Blush pastel and Civic Ledger. Each has its own light and dark palette. Status colours stay the same in every theme.
- **Sidebar:** the chevron button collapses it to an icon rail. `Ctrl B` (`⌘B` on a Mac) does the same, except while typing in a field. On a phone the sidebar becomes a top bar.

The palettes live in `src/lib/themes.ts`. `test/themes.test.ts` checks every theme in both modes: 4.5:1 contrast for text and 3:1 for field borders, the focus ring and the nav underline. Cool mist's light field border is one step darker than the design spec (#7E8E90 instead of #819092) because the spec's value measured 2.99:1.

## Users and passwords

Administrators get a **Users** screen in the sidebar.

- **Add user:** full name, username (suggested from the name), role, and for a collecting officer which officer they act for (or add a new officer with the account). The temporary password is generated, or you can type one or press "Suggest one".
- **Reset password:** gives a new temporary password. The person is signed out everywhere and must choose their own at next sign-in.
- **Disable / Enable:** a disabled account cannot sign in and its open sessions end. You cannot disable yourself or the last active administrator.
- A temporary password is shown **once** and is never stored in readable form. Nothing else works until the person has chosen their own password, including report exports.
- Everyone can change their own password from "Change password" in the sidebar. Passwords need at least 10 characters.
- Every account action is in the audit trail, without any password.

**Divisions.** The Division list on a receipt ends with **+ Add a division…**. Anyone signed in can add one: its name, an optional RCD code (printed in the Div column; leave it blank if the division has none), and whether it controls its own order-of-payment numbers (like MTSS, which leaves that field blank). The new division is available to everyone straight away and is recorded in the audit trail.

## Correcting receipts and OR numbers

Open a receipt and choose **Edit receipt** (collecting officers can edit their own; administrators any). The same 51-C form opens with the receipt filled in.

- You can change the payor, date, fund, division, order of payment, natures, amounts, descriptions, payment mode and cheque details, and add or remove lines.
- A receipt that is **on a deposit slip** keeps its amounts, payment mode, fund and date, because the deposit was made for them. The payor, natures, descriptions, division, order of payment and OR number can still be corrected. To change the rest, remove the deposit first.
- A **voided** receipt can be edited too, including the reason it was voided. It stays voided and out of every total, so correcting it moves no money.
- Every edit is saved in the audit trail with the old and the new value of each field that changed. An edit that changes nothing is not recorded.

**The OR control number is editable** on a new receipt and when correcting one. It must fall in one of that officer's registered books and must not belong to another receipt. A new receipt suggests the next number in the active book; type a different one to use a skipped number or a different booklet.

The book keeps every number accounted for. The suggested next number is one past the highest number used. Any number below it that no receipt uses (skipped, or freed when a receipt was moved to another number) is listed as **unaccounted** in OR books, with a count in the table, so nothing disappears quietly. Use one by typing it as the OR number on a new receipt, or by moving a receipt to it.

**Voided receipts in the reports.** They are not set apart. On the RCD and the Monthly RCD each voided receipt stays with the receipts either side of it by OR number (in the same deposit group as the one before it), shown as CANCELLED, so the series reads in order and no number goes missing. Their amounts are never counted.

## Printing a receipt

On **New receipt**, and on any posted receipt, **Print preview** opens a preview of the receipt as it would print, then **Print** sends it to the printer. Only the values that were typed are printed, each placed in its box on the pre-printed Form 51-C: date, agency, fund, payor, the natures with their description lines and amounts, the total, the amount in words, the payment ticks and cheque details, and the collecting officer. The control number is already printed in your booklet, so it is not reprinted. Account codes, the division and the order-of-payment number never print.

The field positions were measured from the sample copy of the form, so expect to adjust once: print on plain paper, hold it against the real form, then change the form width and the two offsets in the preview. Paper can be A4, Letter, or the form's own size for feeding a booklet. The settings are remembered on that computer. A receipt with more lines and descriptions than the form's 8 rows shows a warning.

## Data rules the database enforces

- Control numbers are unique, and a receipt's number must fall inside its book's range.
- Two OR books can never overlap (a Postgres exclusion constraint).
- A receipt, posted or voided, can be corrected (see below). A voided receipt keeps its number, is listed on the reports as cancelled in its place in the series, and is never counted. A voided receipt always keeps a reason and a time.
- A receipt on a deposit slip cannot be voided until the deposit is removed.
- The audit trail is append-only. Posting, voiding, books, deposits, exports, sign-ins and name edits are all recorded.
- Posting takes a row lock on the officer's active book, so two people posting at once never get the same number.

## Run it

Requirements: Node 22+, Docker.

```bash
cp .env.example .env        # then fill in the four values
docker compose up -d db     # Postgres on 127.0.0.1:5440
npm install
npm run db:migrate
npm run db:seed             # reference data (natures, descriptions, payors) and the users below
npm run db:demo             # optional sample books and receipts, only on an empty ledger
npm run dev                 # http://localhost:3470
```

Users are created with the password in `SEED_PASSWORD`: one `admin` (can act for any officer and manages users) and one collecting officer for each person listed in `config/people.local.json` (each limited to their own books, receipts and deposits). Sign in as `admin`, open **Users**, and reset the passwords before real use.

To run everything in containers: `docker compose up -d --build`. The app migrates and seeds on start.

### Settings (`.env`)

| Name | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection string. |
| `POSTGRES_PASSWORD` | Password for the bundled Postgres container. |
| `SESSION_SECRET` | 32+ random characters used to sign login cookies. |
| `SEED_PASSWORD` | Initial password for the seeded users. |
| `COOKIE_SECURE` | Set to `true` once the app is served over HTTPS. |

## Tests

```bash
docker exec receipt-to-report-db-1 psql -U r2r -d postgres -c "CREATE DATABASE r2r_test"   # once
npm test
```

The tests run against `r2r_test`, never the working database. They cover the report arithmetic (including a check against your October RCD: the first deposit group totals 36,000.00, split 14,000.00 permit fees and 22,000.00 supervision fees), concurrent posting, voiding, books, deposits, the audit trail, and every export.

## Architecture

```
Browser ── Next.js app (server components and server actions)
              ├─ src/services/receipts, books, deposits   posting, voiding, numbering (Postgres transactions)
              ├─ src/services/reports/compute.ts          pure report calculations
              ├─ src/services/reports/build.ts            report models shared by screen, Excel and PDF
              └─ src/services/exports/excel.ts, pdf.ts    ExcelJS and PDFKit
           PostgreSQL ── drizzle/ migrations, including the constraints and triggers above
```

Money is integer centavos in code and `numeric(14,2)` in the database. The screen, the Excel file and the PDF all read the same report model, so they cannot disagree.

## Things to know

- **Exports reproduce your layout, they do not fill your workbook.** The Excel and PDF files follow your RCD, MRDC, SDC and revenue layouts (merged headers, three-row receipt blocks, account-code columns, subtotals as live formulas, summary, certification, signatories) but are generated fresh. Filling your own `.xlsx` cell by cell would need a cleaned copy of the template.
- **Names printed on reports are editable** on the Reports screen (Prepared by, Noted by, and so on, plus a collecting officer's title). Defaults come from your workbook.
- **Fund 338 and the fund-cluster labels:** only Fund 101 has a known cluster label (`01 101 101`). MTSS order-of-payment numbers are controlled by that division and stay blank.
- **Report No.** is typed on the Reports screen. It is not generated.
- Login attempts are limited to 5 failures per username per 10 minutes (per server process).

## Backups

`docker compose up -d` also starts a `backup` service. Once a day at 02:00 Manila time it runs `pg_dump` and writes `backups/r2r-<date>-<time>.dump`. Each file is read back before it is kept, and files older than 30 days are removed. `backups/last-backup.txt` always says whether the last run was `OK` or `FAILED`.

| Setting (`.env`, optional) | Default | Purpose |
|---|---|---|
| `BACKUP_HOUR` | `2` | Hour of day, Manila time. |
| `KEEP_DAYS` | `30` | How long to keep dump files. |

Copy the `backups/` folder off the machine too (another drive, a network share or cloud storage). A backup on the same disk does not survive that disk.

Take one now:

```bash
docker compose run --rm backup once
```

### Restoring

A restore always goes into a separate database first, so you can look at it before anything live is touched:

```bash
docker compose run --rm backup restore /backups/r2r-2026-10-15-0311.dump     # creates r2r_restore
docker exec receipt-to-report-db-1 psql -U r2r -d r2r_restore -c "select count(*) from receipts"
```

The script refuses to restore over the live database. To make a restored copy the live one, stop the app, then rename in Postgres:

```bash
docker compose stop app
docker exec receipt-to-report-db-1 psql -U r2r -d postgres   -c "ALTER DATABASE r2r RENAME TO r2r_old" -c "ALTER DATABASE r2r_restore RENAME TO r2r"
docker compose start app
```

On Windows with Git Bash, put `MSYS_NO_PATHCONV=1` in front of the restore command (or run it from PowerShell), otherwise the `/backups/...` path is rewritten.
