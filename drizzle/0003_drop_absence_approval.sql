ALTER TABLE "absences" DROP CONSTRAINT "absences_decided_by_users_id_fk";
--> statement-breakpoint
ALTER TABLE "absences" DROP COLUMN "status";--> statement-breakpoint
ALTER TABLE "absences" DROP COLUMN "decided_by";--> statement-breakpoint
ALTER TABLE "absences" DROP COLUMN "decided_at";--> statement-breakpoint
ALTER TABLE "absences" DROP COLUMN "decision_note";--> statement-breakpoint
DROP TYPE "public"."absence_status";