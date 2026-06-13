-- PR-L1: trazabilidad de aceptación legal por cuenta (timestamp + versión de documento).
-- AlterTable
ALTER TABLE "User" ADD COLUMN     "termsAcceptedAt" TIMESTAMP(3),
ADD COLUMN     "termsVersion" TEXT,
ADD COLUMN     "privacyAcceptedAt" TIMESTAMP(3),
ADD COLUMN     "privacyVersion" TEXT;

-- Legacy: las cuentas existentes aceptaron el aviso vigente al registrarse (mostrado en signup).
-- Se sellan con su fecha de creación + una versión 'v0-stub' (anterior a los documentos v1), para
-- que un futuro gate de re-aceptación pueda distinguirlas de quienes aceptaron v1.
UPDATE "User"
SET "termsAcceptedAt" = "createdAt",
    "termsVersion" = 'v0-stub',
    "privacyAcceptedAt" = "createdAt",
    "privacyVersion" = 'v0-stub'
WHERE "termsAcceptedAt" IS NULL;
