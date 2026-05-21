-- Rename ParticipantRole enum values: ELDER → COMPANIONEE, CHILD → STEWARD
-- Rename UserRole enum values: ELDER → COMPANIONEE, CHILD → STEWARD

-- Step 1: Create new enum types
CREATE TYPE "ParticipantRole_new" AS ENUM ('COMPANIONEE', 'STEWARD');
CREATE TYPE "UserRole_new" AS ENUM ('COMPANIONEE', 'STEWARD');

-- Step 2: Update Participant.role
ALTER TABLE "participants"
  ALTER COLUMN "role" TYPE "ParticipantRole_new" USING (
    CASE "role"::text
      WHEN 'ELDER' THEN 'COMPANIONEE'::"ParticipantRole_new"
      WHEN 'CHILD' THEN 'STEWARD'::"ParticipantRole_new"
    END
  );

-- Step 3: Update User.role
ALTER TABLE "users"
  ALTER COLUMN "role" TYPE "UserRole_new" USING (
    CASE "role"::text
      WHEN 'ELDER' THEN 'COMPANIONEE'::"UserRole_new"
      WHEN 'CHILD' THEN 'STEWARD'::"UserRole_new"
    END
  );

-- Step 4: Drop old enum types
DROP TYPE "ParticipantRole";
DROP TYPE "UserRole";

-- Step 5: Rename new enum types to original names
ALTER TYPE "ParticipantRole_new" RENAME TO "ParticipantRole";
ALTER TYPE "UserRole_new" RENAME TO "UserRole";
