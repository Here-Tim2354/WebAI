-- WebAI overall schema draft:
-- This file keeps a SQL-oriented schema reference.
-- The dbdiagram-ready source of truth is `overall_er_graph.dbml`.
-- Core tables:
-- auth.users / profiles / conversations / messages
-- model_catalog / model_fetched
-- favorites is a verified conversation-organization extension.
-- search_records was withdrawn and is not present in the current remote schema.

CREATE TYPE "conversation_status" AS ENUM (
  'active',
  'archived'
);

CREATE TYPE "message_sender_type" AS ENUM (
  'user',
  'assistant'
);

CREATE TYPE "message_status" AS ENUM (
  'pending',
  'streaming',
  'complete',
  'cancelled',
  'error'
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
  "model_id" uuid,
  "web_search_enabled" boolean NOT NULL DEFAULT true,
  "thinking_level" text NOT NULL DEFAULT 'minimal',
  "status" conversation_status NOT NULL DEFAULT 'active',
  "archived_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "updated_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "messages" (
  "id" uuid PRIMARY KEY NOT NULL,
  "conversation_id" uuid NOT NULL,
  "sender_type" message_sender_type NOT NULL,
  "content" text NOT NULL,
  "status" message_status NOT NULL DEFAULT 'complete',
  "metadata" jsonb NOT NULL DEFAULT '{}',
  "created_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "favorites" (
  "id" uuid PRIMARY KEY NOT NULL,
  "user_id" uuid NOT NULL,
  "conversation_id" uuid NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "model_catalog" (
  "id" uuid PRIMARY KEY NOT NULL,
  "provider" varchar(50) NOT NULL DEFAULT 'gemini',
  "api_style" varchar(50) NOT NULL DEFAULT 'gemini_native',
  "model_id" varchar(160) UNIQUE NOT NULL,
  "label" varchar(160) NOT NULL,
  "description" text,
  "icon" text,
  "input_token_limit" integer,
  "output_token_limit" integer,
  "capabilities" jsonb NOT NULL DEFAULT '{}',
  "raw_metadata" jsonb NOT NULL DEFAULT '{}',
  "source" varchar(50) NOT NULL DEFAULT 'catalog',
  "default_enabled" boolean NOT NULL DEFAULT false,
  "is_default" boolean NOT NULL DEFAULT false,
  "sort_order" integer NOT NULL DEFAULT 0,
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "updated_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE TABLE "model_fetched" (
  "id" uuid PRIMARY KEY NOT NULL,
  "user_id" uuid NOT NULL,
  "provider" varchar(50) NOT NULL DEFAULT 'gemini',
  "api_style" varchar(50) NOT NULL DEFAULT 'gemini_native',
  "base_url" text NOT NULL,
  "model_id" varchar(160) NOT NULL,
  "label" varchar(160) NOT NULL,
  "description" text,
  "icon" text,
  "input_token_limit" integer,
  "output_token_limit" integer,
  "capabilities" jsonb NOT NULL DEFAULT '{}',
  "raw_metadata" jsonb NOT NULL DEFAULT '{}',
  "catalog_id" uuid,
  "source" varchar(50) NOT NULL DEFAULT 'fetched',
  "is_enabled" boolean NOT NULL DEFAULT false,
  "is_default" boolean NOT NULL DEFAULT false,
  "sort_order" integer NOT NULL DEFAULT 0,
  "fetched_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT (now()),
  "updated_at" timestamptz NOT NULL DEFAULT (now())
);

CREATE INDEX ON "conversations" ("user_id");
CREATE INDEX ON "conversations" ("updated_at");
CREATE INDEX ON "conversations" ("user_id", "status");
CREATE INDEX ON "conversations" ("user_id", "status", "updated_at");
CREATE INDEX ON "conversations" ("archived_at");
CREATE INDEX ON "conversations" ("model_id");

CREATE INDEX ON "messages" ("conversation_id");
CREATE INDEX ON "messages" ("created_at");
CREATE INDEX ON "messages" ("conversation_id", "created_at");

CREATE INDEX ON "favorites" ("conversation_id");
CREATE INDEX ON "favorites" ("user_id", "created_at");
CREATE UNIQUE INDEX ON "favorites" ("user_id", "conversation_id");

CREATE INDEX "model_catalog_default_enabled_idx"
  ON "model_catalog" ("default_enabled", "sort_order", "label");
CREATE UNIQUE INDEX "model_catalog_single_default_idx"
  ON "model_catalog" ("is_default")
  WHERE "is_default" = true;

CREATE INDEX "model_fetched_user_enabled_idx"
  ON "model_fetched" ("user_id", "is_enabled", "sort_order", "label");
CREATE UNIQUE INDEX "model_fetched_user_model_unique"
  ON "model_fetched" ("user_id", "model_id");
CREATE UNIQUE INDEX "model_fetched_single_default_per_user_idx"
  ON "model_fetched" ("user_id")
  WHERE "is_default" = true AND "is_enabled" = true;

COMMENT ON COLUMN "conversations"."system_prompt" IS 'Conversation-level markdown prompt';

ALTER TABLE "profiles"
  ADD FOREIGN KEY ("user_id") REFERENCES "auth"."users" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "conversations"
  ADD FOREIGN KEY ("user_id") REFERENCES "auth"."users" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "conversations"
  ADD FOREIGN KEY ("model_id") REFERENCES "model_fetched" ("id") ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "messages"
  ADD FOREIGN KEY ("conversation_id") REFERENCES "conversations" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "favorites"
  ADD FOREIGN KEY ("user_id") REFERENCES "auth"."users" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "favorites"
  ADD FOREIGN KEY ("conversation_id") REFERENCES "conversations" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "model_fetched"
  ADD FOREIGN KEY ("user_id") REFERENCES "auth"."users" ("id") ON DELETE CASCADE DEFERRABLE INITIALLY IMMEDIATE;

ALTER TABLE "model_fetched"
  ADD FOREIGN KEY ("catalog_id") REFERENCES "model_catalog" ("id") ON DELETE SET NULL DEFERRABLE INITIALLY IMMEDIATE;
