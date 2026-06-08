-- CreateTable
CREATE TABLE "AuditEvent" (
    "id" TEXT NOT NULL,
    "ts" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "action" TEXT NOT NULL,
    "actorUserId" TEXT,
    "actorRole" "UserRole",
    "targetAthleteId" TEXT,
    "ip" TEXT,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AuditEvent_ts_idx" ON "AuditEvent"("ts");

-- CreateIndex
CREATE INDEX "AuditEvent_actorUserId_idx" ON "AuditEvent"("actorUserId");

