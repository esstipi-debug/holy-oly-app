-- CreateEnum
CREATE TYPE "SessionStatus" AS ENUM ('done', 'missed');

-- CreateTable
CREATE TABLE "SessionMark" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "week" INTEGER NOT NULL,
    "idx" INTEGER NOT NULL,
    "status" "SessionStatus" NOT NULL,

    CONSTRAINT "SessionMark_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "SessionMark_athleteId_idx" ON "SessionMark"("athleteId");

-- CreateIndex
CREATE UNIQUE INDEX "SessionMark_athleteId_week_idx_key" ON "SessionMark"("athleteId", "week", "idx");

-- AddForeignKey
ALTER TABLE "SessionMark" ADD CONSTRAINT "SessionMark_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

