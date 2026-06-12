-- CreateTable
CREATE TABLE "SessionRegistro" (
    "id" TEXT NOT NULL,
    "athleteId" TEXT NOT NULL,
    "week" INTEGER NOT NULL,
    "sessionIdx" INTEGER NOT NULL,
    "fecha" TEXT NOT NULL,

    CONSTRAINT "SessionRegistro_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "SessionRegistro_athleteId_week_sessionIdx_key"
    ON "SessionRegistro"("athleteId", "week", "sessionIdx");

-- CreateIndex
CREATE INDEX "SessionRegistro_athleteId_fecha_idx"
    ON "SessionRegistro"("athleteId", "fecha");

-- AddForeignKey
ALTER TABLE "SessionRegistro" ADD CONSTRAINT "SessionRegistro_athleteId_fkey" FOREIGN KEY ("athleteId") REFERENCES "Athlete"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Backfill (D10): fecha = MIN(doneAt) de las filas done de cada sesión ya registrada —
-- aproximación honesta a «primera vez registrada» (el doneAt histórico deriva con ediciones).
-- Los SessionActual históricos NO se tocan (verdad histórica).
INSERT INTO "SessionRegistro" ("id", "athleteId", "week", "sessionIdx", "fecha")
SELECT gen_random_uuid(), "athleteId", "week", "sessionIdx", MIN("doneAt")
FROM "SessionActual"
WHERE "done" = true AND "doneAt" IS NOT NULL
GROUP BY "athleteId", "week", "sessionIdx";
