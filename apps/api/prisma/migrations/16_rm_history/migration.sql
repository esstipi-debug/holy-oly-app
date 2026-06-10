-- CreateTable
CREATE TABLE "RmUpdate" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "lift" TEXT NOT NULL,
    "kg" DOUBLE PRECISION NOT NULL,
    "setAt" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "RmUpdate_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "RmUpdate_athleteId_idx" ON "RmUpdate"("athleteId");

-- AddForeignKey
ALTER TABLE "RmUpdate" ADD CONSTRAINT "RmUpdate_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

