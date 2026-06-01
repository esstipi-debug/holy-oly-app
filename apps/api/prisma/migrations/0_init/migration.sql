-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "Nivel" AS ENUM ('beginner', 'intermediate', 'advanced', 'elite');

-- CreateEnum
CREATE TYPE "VinculoEstado" AS ENUM ('pendiente', 'activo', 'rechazado', 'revocado');

-- CreateEnum
CREATE TYPE "CycleShare" AS ENUM ('full', 'min', 'none');

-- CreateEnum
CREATE TYPE "CycleState" AS ENUM ('regular', 'unreliable', 'amenorrhea');

-- CreateEnum
CREATE TYPE "Metal" AS ENUM ('oro', 'plata', 'bronce');

-- CreateTable
CREATE TABLE "Coach" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Coach_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Athlete" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "iniciales" TEXT NOT NULL,
    "nivel" "Nivel" NOT NULL,
    "macroId" TEXT,
    "compite" BOOLEAN NOT NULL DEFAULT false,
    "weightBandLo" DOUBLE PRECISION,
    "weightBandHi" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Athlete_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vinculo" (
    "id" TEXT NOT NULL,
    "coachId" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "estado" "VinculoEstado" NOT NULL DEFAULT 'pendiente',
    "inviteCode" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Vinculo_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Plan" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "macroId" TEXT NOT NULL,
    "startWeek" INTEGER NOT NULL,
    "rms" JSONB NOT NULL,

    CONSTRAINT "Plan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Competencia" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "week" INTEGER NOT NULL,

    CONSTRAINT "Competencia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MonitorWeek" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "week" INTEGER NOT NULL,
    "acute" DOUBLE PRECISION NOT NULL,
    "hrv" DOUBLE PRECISION NOT NULL,
    "hrvBase" DOUBLE PRECISION NOT NULL,
    "rhr" DOUBLE PRECISION NOT NULL,
    "rhrBase" DOUBLE PRECISION NOT NULL,
    "imr" DOUBLE PRECISION NOT NULL,
    "wellness" DOUBLE PRECISION NOT NULL,
    "recovery" DOUBLE PRECISION NOT NULL,
    "compliance" DOUBLE PRECISION,
    "rpe" DOUBLE PRECISION,
    "bodyweight" DOUBLE PRECISION,

    CONSTRAINT "MonitorWeek_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WellnessItem" (
    "id" TEXT NOT NULL,
    "monitorWeekId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" INTEGER NOT NULL,

    CONSTRAINT "WellnessItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Medal" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "comp" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "cat" TEXT NOT NULL,
    "medal" "Metal" NOT NULL,
    "sn" INTEGER NOT NULL,
    "cj" INTEGER NOT NULL,
    "place" TEXT NOT NULL,

    CONSTRAINT "Medal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CycleConsent" (
    "athleteId" TEXT NOT NULL,
    "share" "CycleShare" NOT NULL,
    "state" "CycleState" NOT NULL,

    CONSTRAINT "CycleConsent_pkey" PRIMARY KEY ("athleteId")
);

-- CreateIndex
CREATE UNIQUE INDEX "Coach_email_key" ON "Coach"("email");

-- CreateIndex
CREATE INDEX "Vinculo_coachId_estado_idx" ON "Vinculo"("coachId", "estado");

-- CreateIndex
CREATE UNIQUE INDEX "Vinculo_coachId_athleteId_key" ON "Vinculo"("coachId", "athleteId");

-- CreateIndex
CREATE UNIQUE INDEX "Plan_athleteId_key" ON "Plan"("athleteId");

-- CreateIndex
CREATE INDEX "Competencia_athleteId_idx" ON "Competencia"("athleteId");

-- CreateIndex
CREATE UNIQUE INDEX "MonitorWeek_athleteId_week_key" ON "MonitorWeek"("athleteId", "week");

-- CreateIndex
CREATE UNIQUE INDEX "WellnessItem_monitorWeekId_key_key" ON "WellnessItem"("monitorWeekId", "key");

-- CreateIndex
CREATE INDEX "Medal_athleteId_idx" ON "Medal"("athleteId");

-- AddForeignKey
ALTER TABLE "Vinculo" ADD CONSTRAINT "Vinculo_coachId_fkey" FOREIGN KEY ("coachId") REFERENCES "Coach"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vinculo" ADD CONSTRAINT "Vinculo_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Plan" ADD CONSTRAINT "Plan_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Competencia" ADD CONSTRAINT "Competencia_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MonitorWeek" ADD CONSTRAINT "MonitorWeek_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WellnessItem" ADD CONSTRAINT "WellnessItem_monitorWeekId_fkey" FOREIGN KEY ("monitorWeekId") REFERENCES "MonitorWeek"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Medal" ADD CONSTRAINT "Medal_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CycleConsent" ADD CONSTRAINT "CycleConsent_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;
