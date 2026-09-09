ALTER TABLE "desk_staff" DROP CONSTRAINT "desk_staff_user_unique";--> statement-breakpoint
ALTER TABLE "notifications" ADD COLUMN "user_id" uuid;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "notify_planning" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "desk_staff_user_idx" ON "desk_staff" USING btree ("user_id");