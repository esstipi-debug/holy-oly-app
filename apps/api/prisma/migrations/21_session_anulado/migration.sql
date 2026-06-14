-- Secuencia de días (2026-06-13): el atleta puede ANULAR un entreno (falló/canceló). El registro
-- ahora lleva estado: 'hecho' (default, lo de siempre) | 'anulado' (día saltado, sin volumen, no
-- ocupa fecha). Las filas existentes quedan 'hecho' por el default — semántica idéntica a antes.
-- AlterTable. CHECK acota los valores a nivel DB (la app sólo escribe 'hecho'/'anulado'); las
-- filas existentes quedan 'hecho' por el default → el constraint se satisface sin backfill.
ALTER TABLE "SessionRegistro"
  ADD COLUMN "estado" TEXT NOT NULL DEFAULT 'hecho'
  CONSTRAINT "SessionRegistro_estado_check" CHECK ("estado" IN ('hecho', 'anulado'));
