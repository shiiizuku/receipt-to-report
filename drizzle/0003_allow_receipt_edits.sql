-- Posted receipts can now be corrected (details, lines and control number); every change is audited by the
-- application. A voided receipt is still final: nothing about it may change.
DROP TRIGGER "receipts_protect_posted_trg" ON "receipts";
--> statement-breakpoint
DROP FUNCTION "receipts_protect_posted"();
--> statement-breakpoint
CREATE FUNCTION "receipts_protect_voided"() RETURNS trigger AS $$
BEGIN
  IF OLD."status" = 'voided' THEN
    RAISE EXCEPTION 'a voided receipt cannot be changed';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE TRIGGER "receipts_protect_voided_trg"
  BEFORE UPDATE ON "receipts"
  FOR EACH ROW EXECUTE FUNCTION "receipts_protect_voided"();
