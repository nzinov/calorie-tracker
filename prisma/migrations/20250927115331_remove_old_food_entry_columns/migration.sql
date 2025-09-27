-- Drop old columns from food_entries table
ALTER TABLE "public"."food_entries" DROP COLUMN "calories";
ALTER TABLE "public"."food_entries" DROP COLUMN "protein";
ALTER TABLE "public"."food_entries" DROP COLUMN "carbs";
ALTER TABLE "public"."food_entries" DROP COLUMN "fat";
ALTER TABLE "public"."food_entries" DROP COLUMN "fiber";