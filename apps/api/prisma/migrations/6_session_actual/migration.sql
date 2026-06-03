-- CreateTable
CREATE TABLE "SessionActual" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "week" INTEGER NOT NULL,
    "sessionIdx" INTEGER NOT NULL,
    "order" INTEGER NOT NULL,
    "movementId" TEXT NOT NULL,
    "done" BOOLEAN NOT NULL DEFAULT true,
    "actualKg" DOUBLE PRECISION,
    "actualReps" INTEGER,
    "actualRpe" DOUBLE PRECISION,
    "note" TEXT,
    "doneAt" TEXT,

    CONSTRAINT "SessionActual_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SessionActual_athleteId_week_idx" ON "SessionActual"("athleteId", "week");

-- CreateIndex
CREATE UNIQUE INDEX "SessionActual_athleteId_week_sessionIdx_order_key" ON "SessionActual"("athleteId", "week", "sessionIdx", "order");

-- AddForeignKey
ALTER TABLE "SessionActual" ADD CONSTRAINT "SessionActual_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

