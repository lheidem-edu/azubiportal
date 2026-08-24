ALTER TYPE "public"."role" ADD VALUE 'DESK';--> statement-breakpoint
ALTER TABLE "desk_staff" ADD COLUMN "user_id" uuid;--> statement-breakpoint
ALTER TABLE "desk_staff" ADD COLUMN "updated_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "desk_staff" ADD CONSTRAINT "desk_staff_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "desk_staff_email_idx" ON "desk_staff" USING btree ("email");--> statement-breakpoint
ALTER TABLE "desk_staff" ADD CONSTRAINT "desk_staff_user_unique" UNIQUE("user_id");