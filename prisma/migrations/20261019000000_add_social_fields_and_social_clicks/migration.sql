-- Add social fields to Restaurant
ALTER TABLE "Restaurant"
  ADD COLUMN IF NOT EXISTS "instagramUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "facebookUrl"  TEXT,
  ADD COLUMN IF NOT EXISTS "shareCaption" TEXT;

-- Create SocialClick table
CREATE TABLE IF NOT EXISTS "social_clicks" (
  "id"           TEXT NOT NULL,
  "restaurant_id" TEXT NOT NULL,
  "platform"     TEXT NOT NULL,
  "sessionId"    TEXT,
  "createdAt"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "social_clicks_pkey" PRIMARY KEY ("id")
);

-- Foreign key from social_clicks to Restaurant
ALTER TABLE "social_clicks"
  ADD CONSTRAINT "social_clicks_restaurant_id_fkey"
  FOREIGN KEY ("restaurant_id")
  REFERENCES "Restaurant"("id")
  ON DELETE RESTRICT
  ON UPDATE CASCADE;

-- Index for querying by restaurant and time
CREATE INDEX IF NOT EXISTS "social_clicks_restaurant_id_createdAt_idx"
  ON "social_clicks"("restaurant_id", "createdAt");
