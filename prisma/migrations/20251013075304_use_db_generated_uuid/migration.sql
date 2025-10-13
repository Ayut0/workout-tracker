/*
  Warnings:

  - The primary key for the `exercises` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `exercises` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The `ownerId` column on the `exercises` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `sets` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `sets` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `user_profiles` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `user_profiles` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `workout_items` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `workout_items` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - The primary key for the `workouts` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - The `id` column on the `workouts` table would be dropped and recreated. This will lead to data loss if there is data in the column.
  - Changed the type of `workoutItemId` on the `sets` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `workoutId` on the `workout_items` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `exerciseId` on the `workout_items` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.
  - Changed the type of `userId` on the `workouts` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- DropForeignKey
ALTER TABLE "public"."exercises" DROP CONSTRAINT "exercises_ownerId_fkey";

-- DropForeignKey
ALTER TABLE "public"."sets" DROP CONSTRAINT "sets_workoutItemId_fkey";

-- DropForeignKey
ALTER TABLE "public"."workout_items" DROP CONSTRAINT "workout_items_exerciseId_fkey";

-- DropForeignKey
ALTER TABLE "public"."workout_items" DROP CONSTRAINT "workout_items_workoutId_fkey";

-- DropForeignKey
ALTER TABLE "public"."workouts" DROP CONSTRAINT "workouts_userId_fkey";

-- AlterTable
ALTER TABLE "exercises" DROP CONSTRAINT "exercises_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL DEFAULT gen_random_uuid(),
DROP COLUMN "ownerId",
ADD COLUMN     "ownerId" UUID,
ADD CONSTRAINT "exercises_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "sets" DROP CONSTRAINT "sets_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL DEFAULT gen_random_uuid(),
DROP COLUMN "workoutItemId",
ADD COLUMN     "workoutItemId" UUID NOT NULL,
ADD CONSTRAINT "sets_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "user_profiles" DROP CONSTRAINT "user_profiles_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL DEFAULT gen_random_uuid(),
ADD CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "workout_items" DROP CONSTRAINT "workout_items_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL DEFAULT gen_random_uuid(),
DROP COLUMN "workoutId",
ADD COLUMN     "workoutId" UUID NOT NULL,
DROP COLUMN "exerciseId",
ADD COLUMN     "exerciseId" UUID NOT NULL,
ADD CONSTRAINT "workout_items_pkey" PRIMARY KEY ("id");

-- AlterTable
ALTER TABLE "workouts" DROP CONSTRAINT "workouts_pkey",
DROP COLUMN "id",
ADD COLUMN     "id" UUID NOT NULL DEFAULT gen_random_uuid(),
DROP COLUMN "userId",
ADD COLUMN     "userId" UUID NOT NULL,
ADD CONSTRAINT "workouts_pkey" PRIMARY KEY ("id");

-- CreateIndex
CREATE UNIQUE INDEX "exercises_ownerId_name_key" ON "exercises"("ownerId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "sets_workoutItemId_setIndex_key" ON "sets"("workoutItemId", "setIndex");

-- CreateIndex
CREATE INDEX "workout_items_workoutId_idx" ON "workout_items"("workoutId");

-- CreateIndex
CREATE INDEX "workouts_userId_date_idx" ON "workouts"("userId", "date");

-- AddForeignKey
ALTER TABLE "exercises" ADD CONSTRAINT "exercises_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "user_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workouts" ADD CONSTRAINT "workouts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workout_items" ADD CONSTRAINT "workout_items_workoutId_fkey" FOREIGN KEY ("workoutId") REFERENCES "workouts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workout_items" ADD CONSTRAINT "workout_items_exerciseId_fkey" FOREIGN KEY ("exerciseId") REFERENCES "exercises"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sets" ADD CONSTRAINT "sets_workoutItemId_fkey" FOREIGN KEY ("workoutItemId") REFERENCES "workout_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
