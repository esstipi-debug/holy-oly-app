-- AlterTable: peso corporal declarado en el onboarding (aditiva, nullable — sin backfill).
ALTER TABLE "Athlete" ADD COLUMN "weightKg" DOUBLE PRECISION;
