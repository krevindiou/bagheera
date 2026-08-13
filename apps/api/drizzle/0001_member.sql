CREATE TABLE "member" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" varchar(128) NOT NULL,
	"password" varchar(255) NOT NULL,
	"country" varchar(2) NOT NULL,
	"active" boolean DEFAULT false NOT NULL,
	"logged_at" timestamp with time zone,
	"activation_token_version" integer DEFAULT 0 NOT NULL,
	"password_reset_token_version" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "member_email_unique" ON "member" USING btree (lower("email"));