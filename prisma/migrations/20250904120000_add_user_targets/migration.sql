-- Add optional user nutrition target fields
ALTER TABLE "users" ADD COLUMN "targetCalories" DOUBLE PRECISION;
ALTER TABLE "users" ADD COLUMN "targetProtein" DOUBLE PRECISION;
ALTER TABLE "users" ADD COLUMN "targetCarbs" DOUBLE PRECISION;
ALTER TABLE "users" ADD COLUMN "targetFat" DOUBLE PRECISION;
ALTER TABLE "users" ADD COLUMN "targetFiber" DOUBLE PRECISION;

