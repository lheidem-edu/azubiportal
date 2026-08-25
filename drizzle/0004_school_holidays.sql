CREATE TABLE "school_holidays" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"school_year" text,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"region" text DEFAULT 'NRW' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"source" "holiday_source" DEFAULT 'AUTO' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "school_holidays_unique" UNIQUE("region","start_date","end_date")
);
--> statement-breakpoint
CREATE INDEX "school_holidays_range_idx" ON "school_holidays" USING btree ("start_date","end_date");