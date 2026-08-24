CREATE TYPE "public"."absence_status" AS ENUM('PENDING', 'APPROVED', 'REJECTED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."absence_type" AS ENUM('VACATION', 'SICK', 'SCHOOL_BLOCK', 'TRAINING', 'OTHER');--> statement-breakpoint
CREATE TYPE "public"."assignment_status" AS ENUM('PLANNED', 'CONFIRMED', 'CANCELLED');--> statement-breakpoint
CREATE TYPE "public"."day_part" AS ENUM('FULL', 'MORNING', 'AFTERNOON');--> statement-breakpoint
CREATE TYPE "public"."holiday_source" AS ENUM('AUTO', 'MANUAL');--> statement-breakpoint
CREATE TYPE "public"."notification_channel" AS ENUM('EMAIL', 'TEAMS');--> statement-breakpoint
CREATE TYPE "public"."notification_status" AS ENUM('PENDING', 'SENT', 'FAILED', 'SKIPPED');--> statement-breakpoint
CREATE TYPE "public"."role" AS ENUM('ADMIN', 'PLANNER', 'APPRENTICE');--> statement-breakpoint
CREATE TYPE "public"."slot_kind" AS ENUM('BREAK', 'FULL_DAY');--> statement-breakpoint
CREATE TABLE "absences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"apprentice_id" uuid NOT NULL,
	"type" "absence_type" NOT NULL,
	"day_part" "day_part" DEFAULT 'FULL' NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"status" "absence_status" DEFAULT 'PENDING' NOT NULL,
	"reason" text,
	"requested_by" uuid,
	"decided_by" uuid,
	"decided_at" timestamp with time zone,
	"decision_note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "apprentices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid,
	"display_name" text NOT NULL,
	"short_name" text,
	"email" text NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date,
	"department" text,
	"is_plannable" boolean DEFAULT true NOT NULL,
	"load_factor" numeric(4, 2) DEFAULT '1.00' NOT NULL,
	"load_offset" numeric(8, 2) DEFAULT '0.00' NOT NULL,
	"notify_email" boolean DEFAULT true NOT NULL,
	"notify_teams" boolean DEFAULT false NOT NULL,
	"teams_webhook_url" text,
	"ics_token" text NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "apprentices_ics_token_unique" UNIQUE("ics_token"),
	CONSTRAINT "apprentices_user_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"date" date NOT NULL,
	"slot_id" uuid NOT NULL,
	"rank" smallint NOT NULL,
	"apprentice_id" uuid NOT NULL,
	"status" "assignment_status" DEFAULT 'PLANNED' NOT NULL,
	"is_locked" boolean DEFAULT false NOT NULL,
	"is_manual" boolean DEFAULT false NOT NULL,
	"note" text,
	"plan_run_id" uuid,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "assignments_slot_rank_unique" UNIQUE("date","slot_id","rank"),
	CONSTRAINT "assignments_slot_person_unique" UNIQUE("date","slot_id","apprentice_id")
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_id" uuid,
	"actor_name" text,
	"action" text NOT NULL,
	"entity" text NOT NULL,
	"entity_id" text,
	"payload" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "company_closures" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"blocks_planning" boolean DEFAULT true NOT NULL,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "coverage_slots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"key" text NOT NULL,
	"label" text NOT NULL,
	"kind" "slot_kind" DEFAULT 'BREAK' NOT NULL,
	"start_time" time NOT NULL,
	"end_time" time NOT NULL,
	"weekdays" smallint[] DEFAULT '{1,2,3,4,5}' NOT NULL,
	"weight" numeric(4, 2) DEFAULT '1.00' NOT NULL,
	"backup_count" smallint DEFAULT 2 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"sort_order" smallint DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "coverage_slots_key_unique" UNIQUE("key")
);
--> statement-breakpoint
CREATE TABLE "desk_shifts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"staff_id" uuid NOT NULL,
	"weekday" smallint NOT NULL,
	"valid_from" date NOT NULL,
	"valid_to" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "desk_staff" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"email" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "desk_staff_absences" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"staff_id" uuid NOT NULL,
	"type" "absence_type" DEFAULT 'SICK' NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"note" text,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"apprentice_id" uuid,
	"channel" "notification_channel" NOT NULL,
	"target" text NOT NULL,
	"subject" text,
	"body" text,
	"status" "notification_status" DEFAULT 'PENDING' NOT NULL,
	"error" text,
	"dedupe_key" text NOT NULL,
	"sent_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "notifications_dedupe_unique" UNIQUE("dedupe_key","channel")
);
--> statement-breakpoint
CREATE TABLE "plan_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"range_start" date NOT NULL,
	"range_end" date NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"stats" jsonb,
	"issues" jsonb
);
--> statement-breakpoint
CREATE TABLE "public_holidays" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"date" date NOT NULL,
	"name" text NOT NULL,
	"region" text DEFAULT 'NRW' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"source" "holiday_source" DEFAULT 'AUTO' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "public_holidays_date_region_unique" UNIQUE("date","region")
);
--> statement-breakpoint
CREATE TABLE "school_terms" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"apprentice_id" uuid NOT NULL,
	"weekday" smallint NOT NULL,
	"valid_from" date NOT NULL,
	"valid_to" date,
	"interval_weeks" smallint DEFAULT 1 NOT NULL,
	"anchor_week" date,
	"note" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"entra_oid" text,
	"role" "role" DEFAULT 'APPRENTICE' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"image" text,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "absences" ADD CONSTRAINT "absences_apprentice_id_apprentices_id_fk" FOREIGN KEY ("apprentice_id") REFERENCES "public"."apprentices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "absences" ADD CONSTRAINT "absences_requested_by_users_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "absences" ADD CONSTRAINT "absences_decided_by_users_id_fk" FOREIGN KEY ("decided_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "apprentices" ADD CONSTRAINT "apprentices_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_slot_id_coverage_slots_id_fk" FOREIGN KEY ("slot_id") REFERENCES "public"."coverage_slots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_apprentice_id_apprentices_id_fk" FOREIGN KEY ("apprentice_id") REFERENCES "public"."apprentices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_plan_run_id_plan_runs_id_fk" FOREIGN KEY ("plan_run_id") REFERENCES "public"."plan_runs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "desk_shifts" ADD CONSTRAINT "desk_shifts_staff_id_desk_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."desk_staff"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "desk_staff_absences" ADD CONSTRAINT "desk_staff_absences_staff_id_desk_staff_id_fk" FOREIGN KEY ("staff_id") REFERENCES "public"."desk_staff"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "desk_staff_absences" ADD CONSTRAINT "desk_staff_absences_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_apprentice_id_apprentices_id_fk" FOREIGN KEY ("apprentice_id") REFERENCES "public"."apprentices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plan_runs" ADD CONSTRAINT "plan_runs_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "school_terms" ADD CONSTRAINT "school_terms_apprentice_id_apprentices_id_fk" FOREIGN KEY ("apprentice_id") REFERENCES "public"."apprentices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "settings" ADD CONSTRAINT "settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "absences_apprentice_idx" ON "absences" USING btree ("apprentice_id");--> statement-breakpoint
CREATE INDEX "absences_range_idx" ON "absences" USING btree ("start_date","end_date");--> statement-breakpoint
CREATE INDEX "apprentices_email_idx" ON "apprentices" USING btree ("email");--> statement-breakpoint
CREATE INDEX "assignments_date_idx" ON "assignments" USING btree ("date");--> statement-breakpoint
CREATE INDEX "assignments_apprentice_idx" ON "assignments" USING btree ("apprentice_id");--> statement-breakpoint
CREATE INDEX "audit_log_created_idx" ON "audit_log" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "company_closures_range_idx" ON "company_closures" USING btree ("start_date","end_date");--> statement-breakpoint
CREATE INDEX "desk_shifts_staff_idx" ON "desk_shifts" USING btree ("staff_id");--> statement-breakpoint
CREATE INDEX "desk_staff_absences_range_idx" ON "desk_staff_absences" USING btree ("start_date","end_date");--> statement-breakpoint
CREATE INDEX "school_terms_apprentice_idx" ON "school_terms" USING btree ("apprentice_id");--> statement-breakpoint
CREATE INDEX "users_entra_oid_idx" ON "users" USING btree ("entra_oid");