-- Add salt tracking to users and food_entries

-- For SQLite (development)
-- These statements are safe for SQLite; in Postgres they will be ignored if run separately.
ALTER TABLE "users" ADD COLUMN "targetSalt" DOUBLE PRECISION;
ALTER TABLE "food_entries" ADD COLUMN "salt" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- For PostgreSQL (production)
-- Wrapped in DO block to avoid errors if column already exists.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='users' AND column_name='targetSalt') THEN
    ALTER TABLE "users" ADD COLUMN "targetSalt" DOUBLE PRECISION;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='food_entries' AND column_name='salt') THEN
    ALTER TABLE "food_entries" ADD COLUMN "salt" DOUBLE PRECISION NOT NULL DEFAULT 0;
  END IF;
END $$;

