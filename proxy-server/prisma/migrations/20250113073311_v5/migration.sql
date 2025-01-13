/*
  Warnings:

  - Added the required column `updated_at` to the `Deployment` table without a default value. This is not possible if the table is not empty.
  - Added the required column `git_url` to the `Project` table without a default value. This is not possible if the table is not empty.
  - Added the required column `name` to the `Project` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updated_at` to the `Project` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Deployment" ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL,
ALTER COLUMN "status" SET DEFAULT 'NOT_STARTED';

-- AlterTable
ALTER TABLE "Project" ADD COLUMN     "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "git_url" TEXT NOT NULL,
ADD COLUMN     "name" TEXT NOT NULL,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL;
