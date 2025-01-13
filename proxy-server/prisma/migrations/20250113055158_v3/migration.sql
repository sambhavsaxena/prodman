-- CreateEnum
CREATE TYPE "deployment_status" AS ENUM ('NOT_STARTED', 'QUEUED', 'IN_PROGRESS', 'SUCCESS', 'FAILED');

-- CreateTable
CREATE TABLE "Project" (
    "id" TEXT NOT NULL,
    "subdomain" TEXT NOT NULL,
    "custom_domain" TEXT,

    CONSTRAINT "Project_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Deployment" (
    "id" TEXT NOT NULL,
    "project_id" TEXT NOT NULL,
    "status" "deployment_status" NOT NULL,

    CONSTRAINT "Deployment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proxy_logs" (
    "id" SERIAL NOT NULL,
    "domain" TEXT NOT NULL,
    "resolved_url" TEXT,
    "error" TEXT,
    "type" TEXT NOT NULL,
    "deployment_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "proxy_logs_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Deployment" ADD CONSTRAINT "Deployment_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "Project"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
