-- CreateTable
CREATE TABLE "FetchTask" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "contentTypes" TEXT[],
    "status" TEXT NOT NULL DEFAULT 'pending',
    "config" JSONB,
    "reason" TEXT,
    "iterations" INTEGER NOT NULL DEFAULT 0,
    "confidence" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "FetchTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FetchConfig" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contentType" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "method" TEXT NOT NULL DEFAULT 'GET',
    "headers" JSONB NOT NULL DEFAULT '{}',
    "params" JSONB NOT NULL DEFAULT '{}',
    "parseWith" TEXT NOT NULL DEFAULT 'json',
    "selectors" JSONB,
    "pagination" JSONB,
    "authRequired" BOOLEAN NOT NULL DEFAULT false,
    "authNote" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "intervalHours" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FetchConfig_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FetchTask_status_idx" ON "FetchTask"("status");

-- CreateIndex
CREATE INDEX "FetchTask_companyId_idx" ON "FetchTask"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "FetchConfig_companyId_contentType_key" ON "FetchConfig"("companyId", "contentType");
