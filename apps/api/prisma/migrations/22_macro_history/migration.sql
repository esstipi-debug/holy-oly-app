-- CreateTable
CREATE TABLE "MacroHistory" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "macroId" TEXT NOT NULL,
    "ordinal" INTEGER NOT NULL,
    "startDate" TEXT NOT NULL,
    "endDate" TEXT NOT NULL,
    "weeks" INTEGER NOT NULL,
    "sessionsDone" INTEGER NOT NULL,
    "sessionsTotal" INTEGER NOT NULL,
    "rmEnd" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MacroHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MacroHistory_athleteId_ordinal_key" ON "MacroHistory"("athleteId", "ordinal");

-- CreateIndex
CREATE INDEX "MacroHistory_athleteId_idx" ON "MacroHistory"("athleteId");

-- AddForeignKey
ALTER TABLE "MacroHistory" ADD CONSTRAINT "MacroHistory_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;
