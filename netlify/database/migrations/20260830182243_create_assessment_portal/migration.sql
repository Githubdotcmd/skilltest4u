CREATE TABLE "announcements" (
	"id" text PRIMARY KEY,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"attachment_url" text DEFAULT '' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "attempts" (
	"id" text PRIMARY KEY,
	"test_id" text NOT NULL,
	"student_name" text NOT NULL,
	"student_email" text NOT NULL,
	"whatsapp" text DEFAULT '' NOT NULL,
	"device_id" text NOT NULL,
	"score" integer NOT NULL,
	"total" integer NOT NULL,
	"time_seconds" integer NOT NULL,
	"submitted_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mentors" (
	"id" text PRIMARY KEY,
	"name" text NOT NULL,
	"username" text NOT NULL UNIQUE,
	"password_hash" text NOT NULL,
	"designation" text NOT NULL,
	"whatsapp" text NOT NULL,
	"university_name" text DEFAULT '' NOT NULL,
	"university_logo" text DEFAULT '' NOT NULL,
	"branding_locked" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "questions" (
	"id" text PRIMARY KEY,
	"test_id" text NOT NULL,
	"prompt" text NOT NULL,
	"options" jsonb NOT NULL,
	"correct_index" integer NOT NULL,
	"position" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" text PRIMARY KEY,
	"mentor_id" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tests" (
	"id" text PRIMARY KEY,
	"mentor_id" text NOT NULL,
	"title" text NOT NULL,
	"course" text NOT NULL,
	"subject" text NOT NULL,
	"semester" text NOT NULL,
	"section" text NOT NULL,
	"duration_minutes" integer NOT NULL,
	"instructions" text DEFAULT '' NOT NULL,
	"signature_url" text DEFAULT '' NOT NULL,
	"access_token" text NOT NULL UNIQUE,
	"link_expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "attempts" ADD CONSTRAINT "attempts_test_id_tests_id_fkey" FOREIGN KEY ("test_id") REFERENCES "tests"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "questions" ADD CONSTRAINT "questions_test_id_tests_id_fkey" FOREIGN KEY ("test_id") REFERENCES "tests"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_mentor_id_mentors_id_fkey" FOREIGN KEY ("mentor_id") REFERENCES "mentors"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "tests" ADD CONSTRAINT "tests_mentor_id_mentors_id_fkey" FOREIGN KEY ("mentor_id") REFERENCES "mentors"("id") ON DELETE CASCADE;