-- Phase 3.1 note:
-- This file keeps a SQL-oriented schema draft for reference.
-- The dbdiagram-ready source of truth is `overall_er_graph.dbml`.
-- Current Phase 3 first-batch implementation should prioritize:
-- auth.users / profiles / conversations / messages

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
