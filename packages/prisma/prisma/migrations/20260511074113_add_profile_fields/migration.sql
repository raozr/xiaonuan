-- AlterTable
ALTER TABLE "child_profiles" ADD COLUMN     "custom_notes" TEXT,
ADD COLUMN     "relationship_to_elder" TEXT;

-- AlterTable
ALTER TABLE "elder_profiles" ADD COLUMN     "greeting_preference" TEXT,
ADD COLUMN     "health_notes" TEXT,
ADD COLUMN     "hobbies" TEXT,
ADD COLUMN     "topics_to_avoid" TEXT;
