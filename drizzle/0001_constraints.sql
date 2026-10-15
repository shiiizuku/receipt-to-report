-- Control numbers must never be reused: no two OR books may overlap.
ALTER TABLE "or_books"
  ADD CONSTRAINT "or_books_no_overlap"
  EXCLUDE USING gist (int8range("from_no", "to_no", '[]') WITH &&);
--> statement-breakpoint
-- Each collecting officer has at most one active book.
CREATE UNIQUE INDEX "or_books_one_active_per_officer" ON "or_books" ("officer_id") WHERE "is_active";
--> statement-breakpoint
-- A receipt's control number must fall inside its book's range.
CREATE FUNCTION "receipts_control_no_in_book"() RETURNS trigger AS $$
DECLARE b RECORD;
BEGIN
  SELECT "from_no", "to_no" INTO b FROM "or_books" WHERE "id" = NEW."book_id";
  IF NEW."control_no" < b."from_no" OR NEW."control_no" > b."to_no" THEN
    RAISE EXCEPTION 'control number % is outside book range %-%', NEW."control_no", b."from_no", b."to_no";
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER "receipts_control_no_in_book_trg"
  BEFORE INSERT OR UPDATE OF "control_no", "book_id" ON "receipts"
  FOR EACH ROW EXECUTE FUNCTION "receipts_control_no_in_book"();
--> statement-breakpoint
-- The audit trail is append-only.
CREATE FUNCTION "audit_events_immutable"() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_events is append-only';
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER "audit_events_no_update"
  BEFORE UPDATE OR DELETE ON "audit_events"
  FOR EACH ROW EXECUTE FUNCTION "audit_events_immutable"();
--> statement-breakpoint
-- A posted receipt's amounts and number cannot change; only void fields and the deposit link may.
CREATE FUNCTION "receipts_protect_posted"() RETURNS trigger AS $$
BEGIN
  IF NEW."control_no" <> OLD."control_no" OR NEW."total" <> OLD."total" OR NEW."payor" <> OLD."payor"
     OR NEW."receipt_date" <> OLD."receipt_date" OR NEW."fund_id" <> OLD."fund_id" OR NEW."officer_id" <> OLD."officer_id" THEN
    RAISE EXCEPTION 'posted receipts cannot be edited; void and re-issue instead';
  END IF;
  IF OLD."status" = 'voided' AND (NEW."status" <> 'voided' OR NEW."deposit_id" IS DISTINCT FROM OLD."deposit_id") THEN
    RAISE EXCEPTION 'a voided receipt cannot be changed';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER "receipts_protect_posted_trg"
  BEFORE UPDATE ON "receipts"
  FOR EACH ROW EXECUTE FUNCTION "receipts_protect_posted"();
