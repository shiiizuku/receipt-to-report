CREATE TABLE "account_groups" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"sort" integer NOT NULL,
	CONSTRAINT "account_groups_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "audit_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" integer,
	"action" text NOT NULL,
	"entity" text NOT NULL,
	"entity_id" text,
	"payload" jsonb
);
--> statement-breakpoint
CREATE TABLE "deposits" (
	"id" serial PRIMARY KEY NOT NULL,
	"slip_no" text NOT NULL,
	"deposit_date" date NOT NULL,
	"officer_id" integer NOT NULL,
	"bank" text NOT NULL,
	"bank_msg_no" text,
	"created_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "deposits_slip_no_unique" UNIQUE("slip_no")
);
--> statement-breakpoint
CREATE TABLE "descriptions" (
	"id" serial PRIMARY KEY NOT NULL,
	"text" text NOT NULL,
	CONSTRAINT "descriptions_text_unique" UNIQUE("text")
);
--> statement-breakpoint
CREATE TABLE "divisions" (
	"code" text PRIMARY KEY NOT NULL,
	"rcc_code" text,
	"sort" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "funds" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"cluster_label" text,
	"sort" integer DEFAULT 0 NOT NULL,
	CONSTRAINT "funds_code_unique" UNIQUE("code"),
	CONSTRAINT "funds_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "natures" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"group_id" integer NOT NULL,
	CONSTRAINT "natures_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "officers" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"title" text,
	CONSTRAINT "officers_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "opening_balances" (
	"officer_id" integer NOT NULL,
	"fund_id" integer NOT NULL,
	"as_of" date NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	CONSTRAINT "opening_balances_officer_id_fund_id_pk" PRIMARY KEY("officer_id","fund_id")
);
--> statement-breakpoint
CREATE TABLE "or_books" (
	"id" serial PRIMARY KEY NOT NULL,
	"book_no" integer NOT NULL,
	"from_no" bigint NOT NULL,
	"to_no" bigint NOT NULL,
	"next_no" bigint NOT NULL,
	"officer_id" integer NOT NULL,
	"received_on" date NOT NULL,
	"is_active" boolean DEFAULT false NOT NULL,
	CONSTRAINT "or_books_book_no_unique" UNIQUE("book_no"),
	CONSTRAINT "or_books_range" CHECK ("or_books"."from_no" <= "or_books"."to_no"),
	CONSTRAINT "or_books_next" CHECK ("or_books"."next_no" >= "or_books"."from_no" AND "or_books"."next_no" <= "or_books"."to_no" + 1)
);
--> statement-breakpoint
CREATE TABLE "payors" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	CONSTRAINT "payors_name_unique" UNIQUE("name")
);
--> statement-breakpoint
CREATE TABLE "receipt_lines" (
	"id" serial PRIMARY KEY NOT NULL,
	"receipt_id" integer NOT NULL,
	"line_no" integer NOT NULL,
	"nature_id" integer NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"descriptions" text[] DEFAULT '{}'::text[] NOT NULL,
	CONSTRAINT "receipt_lines_amount" CHECK ("receipt_lines"."amount" > 0)
);
--> statement-breakpoint
CREATE TABLE "receipts" (
	"id" serial PRIMARY KEY NOT NULL,
	"control_no" bigint NOT NULL,
	"book_id" integer NOT NULL,
	"receipt_date" date NOT NULL,
	"payor" text NOT NULL,
	"officer_id" integer NOT NULL,
	"fund_id" integer NOT NULL,
	"division" text,
	"op_no" text,
	"modes" text[] NOT NULL,
	"instruments" jsonb,
	"total" numeric(14, 2) NOT NULL,
	"deposit_id" integer,
	"status" text DEFAULT 'posted' NOT NULL,
	"void_reason" text,
	"voided_at" timestamp with time zone,
	"voided_by" integer,
	"created_by" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "receipts_control_no_unique" UNIQUE("control_no"),
	CONSTRAINT "receipts_status" CHECK ("receipts"."status" IN ('posted','voided')),
	CONSTRAINT "receipts_void_fields" CHECK (("receipts"."status" = 'voided') = ("receipts"."void_reason" IS NOT NULL AND "receipts"."voided_at" IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE "signatories" (
	"key" text PRIMARY KEY NOT NULL,
	"report" text NOT NULL,
	"label" text NOT NULL,
	"name" text NOT NULL,
	"title" text NOT NULL,
	"sort" integer DEFAULT 0 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" serial PRIMARY KEY NOT NULL,
	"username" text NOT NULL,
	"password_hash" text NOT NULL,
	"display_name" text NOT NULL,
	"role" text DEFAULT 'collector' NOT NULL,
	"officer_id" integer,
	"active" boolean DEFAULT true NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username")
);
--> statement-breakpoint
ALTER TABLE "deposits" ADD CONSTRAINT "deposits_officer_id_officers_id_fk" FOREIGN KEY ("officer_id") REFERENCES "public"."officers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deposits" ADD CONSTRAINT "deposits_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "natures" ADD CONSTRAINT "natures_group_id_account_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."account_groups"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opening_balances" ADD CONSTRAINT "opening_balances_officer_id_officers_id_fk" FOREIGN KEY ("officer_id") REFERENCES "public"."officers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "opening_balances" ADD CONSTRAINT "opening_balances_fund_id_funds_id_fk" FOREIGN KEY ("fund_id") REFERENCES "public"."funds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "or_books" ADD CONSTRAINT "or_books_officer_id_officers_id_fk" FOREIGN KEY ("officer_id") REFERENCES "public"."officers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipt_lines" ADD CONSTRAINT "receipt_lines_receipt_id_receipts_id_fk" FOREIGN KEY ("receipt_id") REFERENCES "public"."receipts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipt_lines" ADD CONSTRAINT "receipt_lines_nature_id_natures_id_fk" FOREIGN KEY ("nature_id") REFERENCES "public"."natures"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_book_id_or_books_id_fk" FOREIGN KEY ("book_id") REFERENCES "public"."or_books"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_officer_id_officers_id_fk" FOREIGN KEY ("officer_id") REFERENCES "public"."officers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_fund_id_funds_id_fk" FOREIGN KEY ("fund_id") REFERENCES "public"."funds"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_division_divisions_code_fk" FOREIGN KEY ("division") REFERENCES "public"."divisions"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_deposit_id_deposits_id_fk" FOREIGN KEY ("deposit_id") REFERENCES "public"."deposits"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_voided_by_users_id_fk" FOREIGN KEY ("voided_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_officer_id_officers_id_fk" FOREIGN KEY ("officer_id") REFERENCES "public"."officers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "receipt_lines_receipt_idx" ON "receipt_lines" USING btree ("receipt_id");--> statement-breakpoint
CREATE INDEX "receipts_date_idx" ON "receipts" USING btree ("receipt_date");--> statement-breakpoint
CREATE INDEX "receipts_officer_date_idx" ON "receipts" USING btree ("officer_id","receipt_date");--> statement-breakpoint
CREATE INDEX "receipts_deposit_idx" ON "receipts" USING btree ("deposit_id");