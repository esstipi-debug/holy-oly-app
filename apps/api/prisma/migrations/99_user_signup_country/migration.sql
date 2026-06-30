-- AlterTable: país de origen aproximado (geo-IP) capturado en el alta. ISO-3166 alpha-2.
-- Aditiva, nullable, sin backfill. Privacy: guardamos SOLO el país, jamás la IP.
ALTER TABLE "User" ADD COLUMN "signupCountry" TEXT;
