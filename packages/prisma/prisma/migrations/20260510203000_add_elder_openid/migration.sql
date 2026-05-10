-- AlterTable
ALTER TABLE "elder_profiles" ADD COLUMN "openid" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "elder_profiles_openid_key" ON "elder_profiles"("openid");
