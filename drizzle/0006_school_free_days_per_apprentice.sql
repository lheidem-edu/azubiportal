CREATE TABLE "school_holiday_apprentices" (
	"school_holiday_id" uuid NOT NULL,
	"apprentice_id" uuid NOT NULL,
	CONSTRAINT "school_holiday_apprentices_school_holiday_id_apprentice_id_pk" PRIMARY KEY("school_holiday_id","apprentice_id")
);
--> statement-breakpoint
ALTER TABLE "school_holiday_apprentices" ADD CONSTRAINT "school_holiday_apprentices_school_holiday_id_school_holidays_id_fk" FOREIGN KEY ("school_holiday_id") REFERENCES "public"."school_holidays"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "school_holiday_apprentices" ADD CONSTRAINT "school_holiday_apprentices_apprentice_id_apprentices_id_fk" FOREIGN KEY ("apprentice_id") REFERENCES "public"."apprentices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "school_holiday_apprentice_idx" ON "school_holiday_apprentices" USING btree ("apprentice_id");