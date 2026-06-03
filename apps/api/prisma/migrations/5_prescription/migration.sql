-- CreateTable
CREATE TABLE "PrescribedExercise" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "week" INTEGER NOT NULL,
    "sessionIdx" INTEGER NOT NULL,
    "order" INTEGER NOT NULL,
    "movementId" TEXT NOT NULL,
    "sets" INTEGER NOT NULL,
    "reps" INTEGER NOT NULL,
    "pct" DOUBLE PRECISION,
    "kgOverride" DOUBLE PRECISION,
    "rpe" DOUBLE PRECISION,
    "flags" TEXT[],
    "notes" TEXT,

    CONSTRAINT "PrescribedExercise_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "PrescribedExercise_athleteId_week_idx" ON "PrescribedExercise"("athleteId", "week");

-- CreateIndex
CREATE UNIQUE INDEX "PrescribedExercise_athleteId_week_sessionIdx_order_key" ON "PrescribedExercise"("athleteId", "week", "sessionIdx", "order");

-- AddForeignKey
ALTER TABLE "PrescribedExercise" ADD CONSTRAINT "PrescribedExercise_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

