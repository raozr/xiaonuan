-- CreateEnum
CREATE TYPE "Gender" AS ENUM ('MALE', 'FEMALE');

-- CreateEnum
CREATE TYPE "VoiceCloneStatus" AS ENUM ('PENDING', 'TRAINING', 'READY', 'FAILED');

-- AlterTable
ALTER TABLE "elder_profiles" ADD COLUMN     "gender" "Gender";

-- AlterTable
ALTER TABLE "families" ADD COLUMN     "cloned_voice_id" TEXT;

-- CreateTable
CREATE TABLE "voice_clones" (
    "id" TEXT NOT NULL,
    "family_id" TEXT NOT NULL,
    "created_by" TEXT NOT NULL,
    "voice_id" TEXT NOT NULL,
    "status" "VoiceCloneStatus" NOT NULL,
    "sample_urls" TEXT[],
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "voice_clones_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "voice_clones" ADD CONSTRAINT "voice_clones_family_id_fkey" FOREIGN KEY ("family_id") REFERENCES "families"("id") ON DELETE CASCADE ON UPDATE CASCADE;
