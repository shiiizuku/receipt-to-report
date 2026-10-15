import { sql } from "drizzle-orm";
import {
  bigint,
  bigserial,
  boolean,
  check,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

/** Collecting officers who sign receipts and hold OR books. */
export const officers = pgTable("officers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  title: text("title"),
  /** The cashier whose name heads the Statement of Deposited Collections. */
  isCashier: boolean("is_cashier").notNull().default(false),
});

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  displayName: text("display_name").notNull(),
  role: text("role").notNull().default("collector"), // admin | collector
  officerId: integer("officer_id").references(() => officers.id),
  active: boolean("active").notNull().default(true),
  /** Set when an administrator creates the account or resets its password. */
  mustChangePassword: boolean("must_change_password").notNull().default(false),
  /** Sessions signed before this moment are no longer accepted. */
  passwordChangedAt: timestamp("password_changed_at", { withTimezone: true }),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const funds = pgTable("funds", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  name: text("name").notNull().unique(),
  clusterLabel: text("cluster_label"),
  sort: integer("sort").notNull().default(0),
});

/** The account-code columns of the RCD (Permit fees, Misc income, ...). */
export const accountGroups = pgTable("account_groups", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  name: text("name").notNull(),
  sort: integer("sort").notNull(),
});

export const natures = pgTable("natures", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  groupId: integer("group_id")
    .notNull()
    .references(() => accountGroups.id),
});

/** Suggestions for the description lines under a nature of collection. */
export const descriptions = pgTable("descriptions", {
  id: serial("id").primaryKey(),
  text: text("text").notNull().unique(),
});

/** Suggestions for the payor field. */
export const payors = pgTable("payors", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
});

export const divisions = pgTable("divisions", {
  code: text("code").primaryKey(),
  rccCode: text("rcc_code"),
  sort: integer("sort").notNull().default(0),
  /** The division controls its own order-of-payment numbers, so receipts leave that field blank. */
  noOpNumber: boolean("no_op_number").notNull().default(false),
});

export const orBooks = pgTable(
  "or_books",
  {
    id: serial("id").primaryKey(),
    bookNo: integer("book_no").notNull().unique(),
    fromNo: bigint("from_no", { mode: "number" }).notNull(),
    toNo: bigint("to_no", { mode: "number" }).notNull(),
    nextNo: bigint("next_no", { mode: "number" }).notNull(),
    officerId: integer("officer_id")
      .notNull()
      .references(() => officers.id),
    receivedOn: date("received_on").notNull(),
    isActive: boolean("is_active").notNull().default(false),
  },
  (t) => [
    check("or_books_range", sql`${t.fromNo} <= ${t.toNo}`),
    check("or_books_next", sql`${t.nextNo} >= ${t.fromNo} AND ${t.nextNo} <= ${t.toNo} + 1`),
  ],
);

export const deposits = pgTable("deposits", {
  id: serial("id").primaryKey(),
  slipNo: text("slip_no").notNull().unique(),
  depositDate: date("deposit_date").notNull(),
  officerId: integer("officer_id")
    .notNull()
    .references(() => officers.id),
  bank: text("bank").notNull(),
  bankMsgNo: text("bank_msg_no"),
  createdBy: integer("created_by").references(() => users.id),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const receipts = pgTable(
  "receipts",
  {
    id: serial("id").primaryKey(),
    controlNo: bigint("control_no", { mode: "number" }).notNull().unique(),
    bookId: integer("book_id")
      .notNull()
      .references(() => orBooks.id),
    receiptDate: date("receipt_date").notNull(),
    payor: text("payor").notNull(),
    officerId: integer("officer_id")
      .notNull()
      .references(() => officers.id),
    fundId: integer("fund_id")
      .notNull()
      .references(() => funds.id),
    division: text("division").references(() => divisions.code),
    opNo: text("op_no"),
    modes: text("modes").array().notNull(), // Cash | Check | Money Order
    instruments: jsonb("instruments").$type<Array<{ kind: string; bank: string; number: string; date: string }>>(),
    total: numeric("total", { precision: 14, scale: 2 }).notNull(),
    depositId: integer("deposit_id").references(() => deposits.id),
    status: text("status").notNull().default("posted"), // posted | voided
    voidReason: text("void_reason"),
    voidedAt: timestamp("voided_at", { withTimezone: true }),
    voidedBy: integer("voided_by").references(() => users.id),
    createdBy: integer("created_by").references(() => users.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    index("receipts_date_idx").on(t.receiptDate),
    index("receipts_officer_date_idx").on(t.officerId, t.receiptDate),
    index("receipts_deposit_idx").on(t.depositId),
    check("receipts_status", sql`${t.status} IN ('posted','voided')`),
    check(
      "receipts_void_fields",
      sql`(${t.status} = 'voided') = (${t.voidReason} IS NOT NULL AND ${t.voidedAt} IS NOT NULL)`,
    ),
  ],
);

export const receiptLines = pgTable(
  "receipt_lines",
  {
    id: serial("id").primaryKey(),
    receiptId: integer("receipt_id")
      .notNull()
      .references(() => receipts.id, { onDelete: "cascade" }),
    lineNo: integer("line_no").notNull(),
    natureId: integer("nature_id")
      .notNull()
      .references(() => natures.id),
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
    descriptions: text("descriptions").array().notNull().default(sql`'{}'::text[]`),
  },
  (t) => [index("receipt_lines_receipt_idx").on(t.receiptId), check("receipt_lines_amount", sql`${t.amount} > 0`)],
);

export const openingBalances = pgTable(
  "opening_balances",
  {
    officerId: integer("officer_id")
      .notNull()
      .references(() => officers.id),
    fundId: integer("fund_id")
      .notNull()
      .references(() => funds.id),
    asOf: date("as_of").notNull(),
    amount: numeric("amount", { precision: 14, scale: 2 }).notNull(),
  },
  (t) => [primaryKey({ columns: [t.officerId, t.fundId] })],
);

/** Editable names and titles printed at the foot of reports. */
export const signatories = pgTable("signatories", {
  key: text("key").primaryKey(), // e.g. mrdc.prepared
  report: text("report").notNull(), // mrdc | sdc
  label: text("label").notNull(),
  name: text("name").notNull(),
  title: text("title").notNull(),
  sort: integer("sort").notNull().default(0),
});

export const auditEvents = pgTable("audit_events", {
  id: bigserial("id", { mode: "number" }).primaryKey(),
  at: timestamp("at", { withTimezone: true }).notNull().defaultNow(),
  userId: integer("user_id"),
  action: text("action").notNull(),
  entity: text("entity").notNull(),
  entityId: text("entity_id"),
  payload: jsonb("payload"),
});
