-- Add AI review generator toggle to Restaurant
ALTER TABLE "Restaurant" ADD COLUMN IF NOT EXISTS "aiEnabled" BOOLEAN NOT NULL DEFAULT true;
