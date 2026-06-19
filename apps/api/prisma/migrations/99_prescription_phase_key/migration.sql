-- Periodización adaptativa v2 — la fase de cada semana pasa a ser estado PERSISTIDO (única fuente de
-- verdad para el read-path), y las ediciones del coach se marcan para que la re-periodización
-- futura-only no las pise (invariante D8). Ambas columnas son aditivas (nullable / con default) →
-- las filas existentes en prod quedan intactas (phaseKey NULL, coachEdited false).
--
-- ⚠️ NOMBRE "99_" (no "24_"): `prisma migrate deploy` aplica en orden LEXICOGRÁFICO del nombre de
-- carpeta, no numérico. Las migraciones de este repo NO están zero-padded → "24_" ordena ANTES que
-- "5_prescription" ('4' < '_'), así que en una DB fresca (verify) el ALTER correría antes de que la
-- tabla exista. "99_" ordena después de 5/6/7/8 (donde se crea PrescribedExercise) → aplica con la
-- tabla presente. En prod (deploy incremental) el nombre es indistinto: corre como la única pendiente.
-- Regla a futuro: toda migración que ALTERe una tabla creada en las migraciones 2–9 debe nombrarse
-- para ordenar lexicográficamente DESPUÉS de ella (no basta el "número siguiente").
ALTER TABLE "PrescribedExercise" ADD COLUMN "phaseKey" TEXT;
ALTER TABLE "PrescribedExercise" ADD COLUMN "coachEdited" BOOLEAN NOT NULL DEFAULT false;
