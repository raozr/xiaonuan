/*
  Warnings:

  - A unique constraint covering the columns `[user_id,family_id]` on the table `child_profiles` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[device_id]` on the table `elder_profiles` will be added. If there are existing duplicate values, this will fail.
  - A unique constraint covering the columns `[openid]` on the table `users` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "child_profiles_openid_key";

-- DropIndex
DROP INDEX "child_profiles_phone_key";

-- DropIndex
DROP INDEX "child_profiles_user_id_key";

-- DropIndex
DROP INDEX "elder_profiles_openid_key";

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "name" TEXT,
ADD COLUMN     "openid" TEXT,
ALTER COLUMN "phone" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "child_profiles_user_id_family_id_key" ON "child_profiles"("user_id", "family_id");

-- CreateIndex
CREATE UNIQUE INDEX "elder_profiles_device_id_key" ON "elder_profiles"("device_id");

-- CreateIndex
CREATE UNIQUE INDEX "users_openid_key" ON "users"("openid");

-- AddForeignKey
ALTER TABLE "child_profiles" ADD CONSTRAINT "child_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
