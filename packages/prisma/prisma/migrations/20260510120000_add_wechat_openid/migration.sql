-- AlterTable
ALTER TABLE "child_profiles" ALTER COLUMN "name" DROP NOT NULL;

-- AlterTable
ALTER TABLE "child_profiles" ADD COLUMN "openid" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "child_profiles_openid_key" ON "child_profiles"("openid");
