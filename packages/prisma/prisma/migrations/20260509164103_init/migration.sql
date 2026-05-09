-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('ELDER', 'CHILD');

-- CreateEnum
CREATE TYPE "SessionPhase" AS ENUM ('GREETING', 'ACTIVE_CHAT', 'CLOSING', 'ENDED');

-- CreateEnum
CREATE TYPE "FeedType" AS ENUM ('TEXT', 'VOICE', 'PHOTO');

-- CreateEnum
CREATE TYPE "FeedCategory" AS ENUM ('PERSON', 'PLACE', 'EVENT', 'PREFERENCE', 'HEALTH');

-- CreateTable
CREATE TABLE "families" (
    "id" TEXT NOT NULL,
    "invite_code" TEXT NOT NULL,
    "invite_code_expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "families_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "elder_profiles" (
    "id" TEXT NOT NULL,
    "family_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "age" INTEGER,
    "dialect" TEXT,
    "device_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "elder_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "child_profiles" (
    "id" TEXT NOT NULL,
    "family_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "is_primary" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "child_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "role" "UserRole" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "family_id" TEXT NOT NULL,
    "phase" "SessionPhase" NOT NULL DEFAULT 'GREETING',
    "started_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" TIMESTAMP(3),
    "turn_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "checkpoints" (
    "id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "topic_summary" TEXT NOT NULL,
    "key_facts" TEXT[],
    "mood_snapshot" TEXT NOT NULL,
    "next_topic_hint" TEXT,
    "checkpoint_id" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "checkpoints_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "family_feeds" (
    "id" TEXT NOT NULL,
    "family_id" TEXT NOT NULL,
    "type" "FeedType" NOT NULL,
    "content" TEXT NOT NULL,
    "category" "FeedCategory" NOT NULL,
    "is_recent" BOOLEAN NOT NULL DEFAULT false,
    "audio_url" TEXT,
    "photo_url" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "family_feeds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "daily_summaries" (
    "id" TEXT NOT NULL,
    "family_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "mood_label" TEXT NOT NULL,
    "duration" INTEGER NOT NULL DEFAULT 0,
    "topic_count" INTEGER NOT NULL DEFAULT 0,
    "highlights" TEXT[],
    "concerns" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "daily_summaries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "habit_logs" (
    "id" TEXT NOT NULL,
    "family_id" TEXT NOT NULL,
    "opened_at" TIMESTAMP(3) NOT NULL,
    "closed_at" TIMESTAMP(3),
    "duration" INTEGER NOT NULL DEFAULT 0,
    "topic_count" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "habit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "families_invite_code_key" ON "families"("invite_code");

-- CreateIndex
CREATE UNIQUE INDEX "elder_profiles_family_id_key" ON "elder_profiles"("family_id");

-- CreateIndex
CREATE UNIQUE INDEX "child_profiles_user_id_key" ON "child_profiles"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "child_profiles_phone_key" ON "child_profiles"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "checkpoints_checkpoint_id_key" ON "checkpoints"("checkpoint_id");

-- CreateIndex
CREATE UNIQUE INDEX "daily_summaries_family_id_date_key" ON "daily_summaries"("family_id", "date");

-- AddForeignKey
ALTER TABLE "elder_profiles" ADD CONSTRAINT "elder_profiles_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "child_profiles" ADD CONSTRAINT "child_profiles_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "checkpoints" ADD CONSTRAINT "checkpoints_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "family_feeds" ADD CONSTRAINT "family_feeds_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "daily_summaries" ADD CONSTRAINT "daily_summaries_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "habit_logs" ADD CONSTRAINT "habit_logs_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE CASCADE ON UPDATE CASCADE;
