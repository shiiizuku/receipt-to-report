ALTER TABLE "officers" ADD COLUMN "is_cashier" boolean DEFAULT false NOT NULL;--> statement-breakpoint
UPDATE "officers" SET "is_cashier" = true WHERE "id" = (SELECT min("id") FROM "officers");
