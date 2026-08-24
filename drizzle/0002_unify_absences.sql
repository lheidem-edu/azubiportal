-- Abwesenheiten von Auszubildenden und Zentrale-Besetzung in einer Tabelle
-- zusammenführen. Reihenfolge: erst Platz schaffen, dann Daten übernehmen,
-- dann die alte Tabelle entfernen, zuletzt die Prüfbedingung ergänzen.

ALTER TABLE "absences" ALTER COLUMN "apprentice_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "absences" ADD COLUMN "desk_staff_id" uuid;--> statement-breakpoint
ALTER TABLE "absences" ADD CONSTRAINT "absences_desk_staff_id_desk_staff_id_fk" FOREIGN KEY ("desk_staff_id") REFERENCES "public"."desk_staff"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "absences_desk_staff_idx" ON "absences" USING btree ("desk_staff_id");--> statement-breakpoint

-- Bestehende Ausfälle der Festbesetzung übernehmen. Sie galten immer sofort,
-- werden also als genehmigt übertragen.
INSERT INTO "absences" (
  "desk_staff_id", "type", "day_part", "start_date", "end_date",
  "status", "reason", "requested_by", "decided_by", "decided_at", "created_at"
)
SELECT
  "staff_id", "type", 'FULL', "start_date", "end_date",
  'APPROVED', "note", "created_by", "created_by", "created_at", "created_at"
FROM "desk_staff_absences";--> statement-breakpoint

DROP TABLE "desk_staff_absences" CASCADE;--> statement-breakpoint
ALTER TABLE "absences" ADD CONSTRAINT "absences_subject_check" CHECK (("absences"."apprentice_id" is not null) <> ("absences"."desk_staff_id" is not null));
