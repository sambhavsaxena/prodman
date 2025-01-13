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
