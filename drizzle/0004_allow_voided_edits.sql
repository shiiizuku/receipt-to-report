-- Voided receipts can be corrected too. They stay out of every total, so editing them moves no money.
-- The check constraint on the void fields still applies: a voided receipt always has a reason and a time.
DROP TRIGGER "receipts_protect_voided_trg" ON "receipts";
--> statement-breakpoint
DROP FUNCTION "receipts_protect_voided"();
