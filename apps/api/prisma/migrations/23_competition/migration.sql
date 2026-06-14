-- CreateEnum
CREATE TYPE "CompRole" AS ENUM ('pico', 'paso');

-- AlterTable (aditivo, nullable — las filas existentes quedan en NULL)
ALTER TABLE "Competencia" ADD COLUMN "competitionId" TEXT;

-- AlterTable (aditivo, nullable)
ALTER TABLE "Medal" ADD COLUMN "competitionId" TEXT;

-- CreateTable
CREATE TABLE "Competition" (
    "id" TEXT NOT NULL,
    "coachId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "place" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Competition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CompetitionEntry" (
    "id" TEXT NOT NULL,
    "competitionId" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "role" "CompRole" NOT NULL,
    "medal" "Metal",
    "cat" TEXT,
    "sn" INTEGER,
    "cj" INTEGER,
    "place" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CompetitionEntry_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Competencia_competitionId_idx" ON "Competencia"("competitionId");

-- CreateIndex
CREATE INDEX "Competition_coachId_idx" ON "Competition"("coachId");

-- CreateIndex
CREATE UNIQUE INDEX "CompetitionEntry_competitionId_athleteId_key" ON "CompetitionEntry"("competitionId", "athleteId");

-- CreateIndex
CREATE INDEX "CompetitionEntry_competitionId_idx" ON "CompetitionEntry"("competitionId");

-- CreateIndex
CREATE INDEX "CompetitionEntry_athleteId_idx" ON "CompetitionEntry"("athleteId");

-- AddForeignKey
ALTER TABLE "Competition" ADD CONSTRAINT "Competition_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "Coach"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetitionEntry" ADD CONSTRAINT "CompetitionEntry_competitionId_fkey" FOREIGN KEY ("competitionId") REFERENCES "Competition"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CompetitionEntry" ADD CONSTRAINT "CompetitionEntry_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;
