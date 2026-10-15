ALTER TABLE "divisions" ADD COLUMN "no_op_number" boolean DEFAULT false NOT NULL;--> statement-breakpoint
UPDATE "divisions" SET "no_op_number" = true WHERE "code" = 'MTSS';
