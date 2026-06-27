-- CreateTable
CREATE TABLE "AgentStateLog" (
    "id" TEXT NOT NULL,
    "taskId" TEXT NOT NULL,
    "agent" TEXT NOT NULL,
    "node" TEXT NOT NULL,
    "state" JSONB NOT NULL,
    "note" JSONB,
    "nextNode" TEXT,
    "status" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgentStateLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AgentStateLog_taskId_createdAt_idx" ON "AgentStateLog"("taskId", "createdAt");

-- CreateIndex
CREATE INDEX "AgentStateLog_agent_taskId_idx" ON "AgentStateLog"("agent", "taskId");

-- CreateIndex
CREATE INDEX "AgentStateLog_taskId_status_idx" ON "AgentStateLog"("taskId", "status");
