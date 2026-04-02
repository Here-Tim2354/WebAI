-- WebAI overall schema draft:
-- This file keeps a SQL-oriented schema reference.
-- The dbdiagram-ready source of truth is `overall_er_graph.dbml`.
-- Current actual implementation includes:
-- auth.users / profiles / conversations / messages
-- openai_compatible_models / gemini_models
-- favorites and search_records remain in the overall design, but are not yet landed.

CREATE TYPE "conversation_status" AS ENUM (
  'active',
  'archived'
);

CREATE TYPE "message_sender_type" AS ENUM (
  'user',
  'assistant'
);

CREATE TABLE "auth"."users" (
  "id" uuid PRIMARY KEY NOT NULL,
  "email" varchar(255) UNIQUE NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "profiles" (
  "user_id" uuid PRIMARY KEY NOT NULL,
  "display_name" varchar(100),
  "avatar_url" varchar(500),
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "updated_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "conversations" (
  "id" uuid PRIMARY KEY NOT NULL,
  "user_id" uuid NOT NULL,
  "title" varchar(100) NOT NULL,
  "system_prompt" text,
  "status" conversation_status NOT NULL DEFAULT 'active',
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "updated_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "messages" (
  "id" uuid PRIMARY KEY NOT NULL,
  "conversation_id" uuid NOT NULL,
  "sender_type" message_sender_type NOT NULL,
  "content" text NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "favorites" (
  "id" uuid PRIMARY KEY NOT NULL,
  "user_id" uuid NOT NULL,
  "message_id" uuid NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "search_records" (
  "id" uuid PRIMARY KEY NOT NULL,
  "user_id" uuid NOT NULL,
  "keyword" varchar(100) NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "openai_compatible_models" (
  "id" uuid PRIMARY KEY NOT NULL,
  "model_id" varchar(120) UNIQUE NOT NULL,
  "upstream_object" varchar(50),
  "owned_by" varchar(120),
  "upstream_created_at" timestamptz,
  "label" varchar(120) NOT NULL,
  "description" text,
  "provider_name" varchar(120) NOT NULL DEFAULT 'openai',
  "base_url" text,
  "api_style" varchar(50) NOT NULL DEFAULT 'openai_compatible',
  "supports_text" boolean NOT NULL DEFAULT true,
  "supports_image" boolean NOT NULL DEFAULT false,
  "supports_audio" boolean NOT NULL DEFAULT false,
  "supports_video" boolean NOT NULL DEFAULT false,
  "supports_web_search" boolean NOT NULL DEFAULT false,
  "supports_function_calling" boolean NOT NULL DEFAULT false,
  "supports_tools" boolean NOT NULL DEFAULT false,
  "supports_file_search" boolean NOT NULL DEFAULT false,
  "supports_structured_outputs" boolean NOT NULL DEFAULT false,
  "supports_streaming" boolean NOT NULL DEFAULT true,
  "supports_reasoning" boolean NOT NULL DEFAULT false,
  "context_window" integer,
  "max_output_tokens" integer,
  "is_enabled" boolean NOT NULL DEFAULT true,
  "is_default" boolean NOT NULL DEFAULT false,
  "sort_order" integer NOT NULL DEFAULT 0,
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "updated_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "gemini_models" (
  "id" uuid PRIMARY KEY NOT NULL,
  "name" varchar(160) UNIQUE NOT NULL,
  "base_model_id" varchar(120),
  "version" varchar(120),
  "display_name" varchar(160) NOT NULL,
  "description" text,
  "input_token_limit" integer,
  "output_token_limit" integer,
  "supported_generation_methods" text[] NOT NULL DEFAULT '{}',
  "thinking" boolean,
  "temperature" numeric(4,3),
  "max_temperature" numeric(4,3),
  "top_p" numeric(5,4),
  "top_k" integer,
  "api_style" varchar(50) NOT NULL DEFAULT 'gemini_native',
  "supports_text" boolean NOT NULL DEFAULT true,
  "supports_image" boolean NOT NULL DEFAULT false,
  "supports_audio" boolean NOT NULL DEFAULT false,
  "supports_video" boolean NOT NULL DEFAULT false,
  "supports_google_search" boolean NOT NULL DEFAULT false,
  "supports_url_context" boolean NOT NULL DEFAULT false,
  "supports_code_execution" boolean NOT NULL DEFAULT false,
  "supports_function_calling" boolean NOT NULL DEFAULT false,
  "supports_tools" boolean NOT NULL DEFAULT false,
  "supports_streaming" boolean NOT NULL DEFAULT true,
  "supports_reasoning" boolean NOT NULL DEFAULT false,
  "is_enabled" boolean NOT NULL DEFAULT true,
  "is_default" boolean NOT NULL DEFAULT false,
  "sort_order" integer NOT NULL DEFAULT 0,
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "updated_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE INDEX ON "conversations" ("user_id");
CREATE INDEX ON "conversations" ("updated_at");
CREATE INDEX ON "conversations" ("user_id", "status");

CREATE INDEX ON "messages" ("conversation_id");
CREATE INDEX ON "messages" ("created_at");
CREATE INDEX ON "messages" ("conversation_id", "created_at");

CREATE INDEX ON "favorites" ("user_id");
CREATE INDEX ON "favorites" ("message_id");
CREATE UNIQUE INDEX ON "favorites" ("user_id", "message_id");

CREATE INDEX ON "search_records" ("user_id");
CREATE INDEX ON "search_records" ("created_at");

CREATE INDEX ON "openai_compatible_models" ("is_enabled");
CREATE INDEX ON "openai_compatible_models" ("sort_order", "label");
CREATE UNIQUE INDEX ON "openai_compatible_models" ("is_default") WHERE "is_default" = true;

CREATE INDEX ON "gemini_models" ("is_enabled");
CREATE INDEX ON "gemini_models" ("sort_order", "display_name");
CREATE UNIQUE INDEX ON "gemini_models" ("is_default") WHERE "is_default" = true;

COMMENT ON COLUMN "conversations"."system_prompt" IS 'Conversation-level markdown prompt';

ALTER TABLE "profiles"
  ADD FOREIGN KEY ("user_id") REFERENCES "auth"."users" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "conversations"
  ADD FOREIGN KEY ("user_id") REFERENCES "auth"."users" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "messages"
  ADD FOREIGN KEY ("conversation_id") REFERENCES "conversations" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "favorites"
  ADD FOREIGN KEY ("user_id") REFERENCES "auth"."users" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "favorites"
  ADD FOREIGN KEY ("message_id") REFERENCES "messages" ("id") DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "search_records"
  ADD FOREIGN KEY ("user_id") REFERENCES "auth"."users" ("id") DEFERRABLE INITIALLY IMMEDIATE;
