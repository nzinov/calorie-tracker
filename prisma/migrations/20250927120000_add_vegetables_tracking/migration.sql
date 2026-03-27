-- Add vegetables tracking to users and user_foods

-- For SQLite (development)
-- These statements are safe for SQLite; in Postgres they will be ignored if run separately.
ALTER TABLE "users" ADD COLUMN "targetVegetables" DOUBLE PRECISION;
ALTER TABLE "user_foods" ADD COLUMN "vegetablesPer100g" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- For PostgreSQL (production)
-- Wrapped in DO block to avoid errors if column already exists.
DO $$
BEGIN
  -- Add targetVegetables to users if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='users' AND column_name='targetVegetables') THEN
    ALTER TABLE "users" ADD COLUMN "targetVegetables" DOUBLE PRECISION;
  END IF;

  -- Add vegetablesPer100g to user_foods if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='user_foods' AND column_name='vegetablesPer100g') THEN
    ALTER TABLE "user_foods" ADD COLUMN "vegetablesPer100g" DOUBLE PRECISION NOT NULL DEFAULT 0;
  END IF;
END $$;

-- Set default value for existing users
UPDATE "users" SET "targetVegetables" = 300 WHERE "targetVegetables" IS NULL;

-- Set default value for existing user_foods (vegetablesPer100g is already set to 0 by DEFAULT constraint)