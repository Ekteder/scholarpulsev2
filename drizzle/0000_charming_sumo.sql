CREATE TABLE "achievements" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"icon" text DEFAULT 'Award' NOT NULL,
	"category" text DEFAULT 'milestone' NOT NULL,
	"requirement_type" text NOT NULL,
	"requirement_value" integer NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "active_timer_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"subject_id" uuid NOT NULL,
	"topic" text DEFAULT 'Focused Study' NOT NULL,
	"notes" text DEFAULT '',
	"mode" text DEFAULT 'stopwatch' NOT NULL,
	"phase" text DEFAULT 'focus' NOT NULL,
	"status" text DEFAULT 'running' NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"last_resumed_at" timestamp with time zone NOT NULL,
	"accumulated_seconds" integer DEFAULT 0 NOT NULL,
	"total_focus_seconds" integer DEFAULT 0 NOT NULL,
	"target_duration_seconds" integer DEFAULT 1500 NOT NULL,
	"completed_pomodoros" integer DEFAULT 0 NOT NULL,
	"state_version" integer DEFAULT 1 NOT NULL,
	"client_device_id" text DEFAULT '',
	"idempotency_key" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "active_timer_sessions_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "admin_allowlist" (
	"email" text PRIMARY KEY NOT NULL,
	"role" text DEFAULT 'admin' NOT NULL,
	"notes" text DEFAULT '',
	"added_by" text DEFAULT 'system' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "curriculum_papers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subject_id" uuid NOT NULL,
	"user_id" text,
	"title" text NOT NULL,
	"paper_code" text,
	"display_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "curriculum_resources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"subject_id" uuid NOT NULL,
	"topic_id" uuid NOT NULL,
	"title" text NOT NULL,
	"url" text NOT NULL,
	"resource_type" text DEFAULT 'link' NOT NULL,
	"page_reference" text DEFAULT '',
	"notes" text DEFAULT '',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "curriculum_stages" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"color" text DEFAULT '#3B82F6' NOT NULL,
	"badge_text" text DEFAULT '',
	"display_order" integer DEFAULT 0 NOT NULL,
	"weight" integer DEFAULT 1 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "curriculum_subjects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"color" text DEFAULT '#2563EB' NOT NULL,
	"icon" text DEFAULT 'BookOpen' NOT NULL,
	"display_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "curriculum_topics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"paper_id" uuid NOT NULL,
	"subject_id" uuid NOT NULL,
	"user_id" text,
	"title" text NOT NULL,
	"chapter_number" integer,
	"display_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "device_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"fcm_token" text NOT NULL,
	"device_id" text NOT NULL,
	"platform" text DEFAULT 'android' NOT NULL,
	"device_model" text DEFAULT '' NOT NULL,
	"app_version" text DEFAULT '' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_used_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "goal_templates" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '',
	"target_type" text NOT NULL,
	"target_value" integer NOT NULL,
	"period" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "goals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"subject_id" uuid,
	"title" text NOT NULL,
	"goal_type" text DEFAULT 'daily' NOT NULL,
	"target_value" integer NOT NULL,
	"current_value" integer DEFAULT 0 NOT NULL,
	"unit" text DEFAULT 'minutes' NOT NULL,
	"start_date" text NOT NULL,
	"end_date" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification_preferences" (
	"user_id" text PRIMARY KEY NOT NULL,
	"browser_notifications_enabled" boolean DEFAULT false NOT NULL,
	"push_notifications_enabled" boolean DEFAULT true NOT NULL,
	"sound_chimes_enabled" boolean DEFAULT true NOT NULL,
	"daily_reminder_enabled" boolean DEFAULT true NOT NULL,
	"daily_reminder_time" text DEFAULT '19:00' NOT NULL,
	"schedule_reminder_enabled" boolean DEFAULT true NOT NULL,
	"task_deadline_reminder_enabled" boolean DEFAULT true NOT NULL,
	"goal_completion_alert" boolean DEFAULT true NOT NULL,
	"streak_milestone_alert" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"email" text NOT NULL,
	"full_name" text DEFAULT 'Student Scholar' NOT NULL,
	"avatar_url" text DEFAULT '',
	"daily_study_target_minutes" integer DEFAULT 360 NOT NULL,
	"preferred_study_time" text DEFAULT 'evening' NOT NULL,
	"timezone" text DEFAULT 'Asia/Dhaka' NOT NULL,
	"theme_preference" text DEFAULT 'light' NOT NULL,
	"pomodoro_focus_minutes" integer DEFAULT 25 NOT NULL,
	"pomodoro_short_break_minutes" integer DEFAULT 5 NOT NULL,
	"pomodoro_long_break_minutes" integer DEFAULT 15 NOT NULL,
	"pomodoro_long_break_interval" integer DEFAULT 4 NOT NULL,
	"onboarding_completed" boolean DEFAULT false NOT NULL,
	"target_exam_name" text DEFAULT 'HSC 2027' NOT NULL,
	"target_exam_date" text DEFAULT '2027-06-01' NOT NULL,
	"gamification_xp" integer DEFAULT 0 NOT NULL,
	"is_banned" boolean DEFAULT false NOT NULL,
	"banned_reason" text DEFAULT '',
	"banned_at" timestamp with time zone,
	"targeted_announcement" text DEFAULT '',
	"targeted_announcement_created_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "profiles_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "revision_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"subject_id" uuid NOT NULL,
	"topic_id" uuid NOT NULL,
	"category" text NOT NULL,
	"activity_date" text,
	"is_completed" boolean DEFAULT true NOT NULL,
	"book_name" text,
	"pages_read" integer,
	"questions_solved" integer,
	"correct_count" integer,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "schedule_templates" (
	"id" text PRIMARY KEY NOT NULL,
	"title" text NOT NULL,
	"day_of_week" integer NOT NULL,
	"start_time" text NOT NULL,
	"end_time" text NOT NULL,
	"subject_id" text,
	"activity_type" text DEFAULT 'study',
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"subject_id" uuid NOT NULL,
	"day_of_week" integer NOT NULL,
	"start_time" text NOT NULL,
	"end_time" text NOT NULL,
	"description" text DEFAULT '',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "study_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"subject_id" uuid NOT NULL,
	"idempotency_key" text,
	"start_time" timestamp with time zone NOT NULL,
	"end_time" timestamp with time zone NOT NULL,
	"duration_seconds" integer NOT NULL,
	"topic" text DEFAULT 'General Study' NOT NULL,
	"notes" text DEFAULT '',
	"productivity_rating" integer DEFAULT 4,
	"session_type" text DEFAULT 'manual' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "study_sessions_idempotency_key_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "subjects" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text DEFAULT '',
	"color" text DEFAULT '#2563EB' NOT NULL,
	"icon" text DEFAULT 'BookOpen' NOT NULL,
	"daily_target_minutes" integer DEFAULT 60 NOT NULL,
	"weekly_target_minutes" integer DEFAULT 300 NOT NULL,
	"is_archived" boolean DEFAULT false NOT NULL,
	"notes" text DEFAULT '',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sync_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"event_type" text NOT NULL,
	"payload" text NOT NULL,
	"client_device_id" text DEFAULT '',
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "system_configurations" (
	"key" text PRIMARY KEY NOT NULL,
	"value" text NOT NULL,
	"description" text DEFAULT '',
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_by" text DEFAULT 'system'
);
--> statement-breakpoint
CREATE TABLE "tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"subject_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text DEFAULT '',
	"due_date" timestamp with time zone NOT NULL,
	"priority" text DEFAULT 'medium' NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"completed_at" timestamp with time zone,
	"idempotency_key" text,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "tasks_idempotency_key_unique" UNIQUE("idempotency_key")
);
--> statement-breakpoint
CREATE TABLE "user_achievements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"achievement_id" text NOT NULL,
	"unlocked_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user_curriculum_customizations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"target_type" text NOT NULL,
	"target_id" uuid NOT NULL,
	"is_hidden" boolean DEFAULT false NOT NULL,
	"custom_title" text,
	"custom_order" integer,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "active_timer_sessions" ADD CONSTRAINT "active_timer_sessions_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "curriculum_papers" ADD CONSTRAINT "curriculum_papers_subject_id_curriculum_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."curriculum_subjects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "curriculum_resources" ADD CONSTRAINT "curriculum_resources_subject_id_curriculum_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."curriculum_subjects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "curriculum_resources" ADD CONSTRAINT "curriculum_resources_topic_id_curriculum_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."curriculum_topics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "curriculum_topics" ADD CONSTRAINT "curriculum_topics_paper_id_curriculum_papers_id_fk" FOREIGN KEY ("paper_id") REFERENCES "public"."curriculum_papers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "curriculum_topics" ADD CONSTRAINT "curriculum_topics_subject_id_curriculum_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."curriculum_subjects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "device_tokens" ADD CONSTRAINT "device_tokens_user_id_profiles_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "goals" ADD CONSTRAINT "goals_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "revision_records" ADD CONSTRAINT "revision_records_subject_id_curriculum_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."curriculum_subjects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "revision_records" ADD CONSTRAINT "revision_records_topic_id_curriculum_topics_id_fk" FOREIGN KEY ("topic_id") REFERENCES "public"."curriculum_topics"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schedules" ADD CONSTRAINT "schedules_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "study_sessions" ADD CONSTRAINT "study_sessions_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tasks" ADD CONSTRAINT "tasks_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_achievements" ADD CONSTRAINT "user_achievements_achievement_id_achievements_id_fk" FOREIGN KEY ("achievement_id") REFERENCES "public"."achievements"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "active_timer_user_id_idx" ON "active_timer_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "curriculum_papers_subject_idx" ON "curriculum_papers" USING btree ("subject_id");--> statement-breakpoint
CREATE INDEX "curriculum_papers_user_idx" ON "curriculum_papers" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "curriculum_resources_user_idx" ON "curriculum_resources" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "curriculum_resources_topic_idx" ON "curriculum_resources" USING btree ("topic_id");--> statement-breakpoint
CREATE INDEX "curriculum_resources_subject_idx" ON "curriculum_resources" USING btree ("subject_id");--> statement-breakpoint
CREATE INDEX "curriculum_stages_order_idx" ON "curriculum_stages" USING btree ("display_order");--> statement-breakpoint
CREATE INDEX "curriculum_subjects_user_idx" ON "curriculum_subjects" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "curriculum_subjects_code_idx" ON "curriculum_subjects" USING btree ("code");--> statement-breakpoint
CREATE INDEX "curriculum_topics_paper_idx" ON "curriculum_topics" USING btree ("paper_id");--> statement-breakpoint
CREATE INDEX "curriculum_topics_subject_idx" ON "curriculum_topics" USING btree ("subject_id");--> statement-breakpoint
CREATE INDEX "curriculum_topics_user_idx" ON "curriculum_topics" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "device_tokens_fcm_token_unique" ON "device_tokens" USING btree ("fcm_token");--> statement-breakpoint
CREATE UNIQUE INDEX "device_tokens_user_device_unique" ON "device_tokens" USING btree ("user_id","device_id");--> statement-breakpoint
CREATE INDEX "device_tokens_user_active_idx" ON "device_tokens" USING btree ("user_id","is_active");--> statement-breakpoint
CREATE INDEX "device_tokens_platform_active_idx" ON "device_tokens" USING btree ("platform","is_active");--> statement-breakpoint
CREATE INDEX "goals_user_id_idx" ON "goals" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "profiles_user_id_idx" ON "profiles" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "revision_records_user_id_idx" ON "revision_records" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "revision_records_subject_id_idx" ON "revision_records" USING btree ("subject_id");--> statement-breakpoint
CREATE INDEX "revision_records_topic_id_idx" ON "revision_records" USING btree ("topic_id");--> statement-breakpoint
CREATE INDEX "revision_records_user_cat_idx" ON "revision_records" USING btree ("user_id","category");--> statement-breakpoint
CREATE UNIQUE INDEX "revision_records_user_topic_cat_idx" ON "revision_records" USING btree ("user_id","topic_id","category");--> statement-breakpoint
CREATE INDEX "schedule_templates_day_idx" ON "schedule_templates" USING btree ("day_of_week");--> statement-breakpoint
CREATE INDEX "schedules_user_id_idx" ON "schedules" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "study_sessions_user_id_idx" ON "study_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "study_sessions_subject_id_idx" ON "study_sessions" USING btree ("subject_id");--> statement-breakpoint
CREATE INDEX "study_sessions_user_start_idx" ON "study_sessions" USING btree ("user_id","start_time");--> statement-breakpoint
CREATE INDEX "subjects_user_id_idx" ON "subjects" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sync_events_user_id_id_idx" ON "sync_events" USING btree ("user_id","id");--> statement-breakpoint
CREATE INDEX "sync_events_created_at_idx" ON "sync_events" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "tasks_user_id_idx" ON "tasks" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "tasks_subject_id_idx" ON "tasks" USING btree ("subject_id");--> statement-breakpoint
CREATE UNIQUE INDEX "tasks_idempotency_key_idx" ON "tasks" USING btree ("idempotency_key");--> statement-breakpoint
CREATE INDEX "user_achievements_user_id_idx" ON "user_achievements" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_achievements_unique_idx" ON "user_achievements" USING btree ("user_id","achievement_id");--> statement-breakpoint
CREATE INDEX "user_curr_cust_user_idx" ON "user_curriculum_customizations" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "user_curr_cust_unique_idx" ON "user_curriculum_customizations" USING btree ("user_id","target_type","target_id");