-- PR-L2: acto de consentimiento informado del módulo de ciclo (opt-in explícito de la atleta).
-- AlterTable
ALTER TABLE "CycleConsent" ADD COLUMN     "consentedAt" TIMESTAMP(3),
ADD COLUMN     "consentVersion" TEXT;

-- Legacy: las filas existentes ya tienen registro (la atleta optó al fijar share/estado), así que
-- se las marca consentidas a la fecha de la migración con una versión 'v0-stub' (anterior al
-- consentimiento informado v1). Quien aún no había registrado nada no tiene fila → seguirá viendo
-- el gate de activación.
UPDATE "CycleConsent"
SET "consentedAt" = now(),
    "consentVersion" = 'v0-stub'
WHERE "consentedAt" IS NULL;
