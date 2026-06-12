/**
 * readiness → modulación: capa de RATIONALE legible (coach-only) sobre lo que el motor Prilepin
 * YA aplicó. PURA — no recalcula la dosis: deriva todo del `EngineWeek` (única fuente, sin drift).
 *
 * El motor (`prilepin.ts`) ya modula por la banda del día (`readinessFactor` 1/0.9/0.75 dentro de
 * `taperFinal`, y `heavySinglesAdvisory` para red+90+). Acá solo se le pone NOMBRE y EXPLICACIÓN a
 * ese ajuste para que sea visible en el preview, en vez de quedar escondido en un factor numérico.
 *
 * Reglas duras: read-only, NO va a superficie de atleta (HR-1), NO entra al semáforo, sin RPE (D1).
 * Sin readiness (`inputs.readiness === null`) → directiva "none" honesta (sin banda, sin factor).
 *
 * Spec: docs/superpowers/specs/2026-06-12-readiness-modulacion-design.md
 */
import type { EngineWeek, ReadinessBand, ReadinessDirective, ReadinessModulation } from "../types";

const DIRECTIVE: Record<ReadinessBand, ReadinessDirective> = {
  green: "allow",
  amber: "hold",
  red: "cut",
};

const HEADLINE: Record<ReadinessBand, string> = {
  green: "Readiness verde",
  amber: "Readiness ámbar",
  red: "Readiness roja",
};

/** Microcopy del ajuste — explica, no castiga. La banda roja con 90+ suma la guarda de singles. */
const RATIONALE: Record<ReadinessBand, string> = {
  green: "Buena recuperación: se permite lo planificado.",
  amber: "Recuperación parcial: intensidad sostenida, sin subir el tope; volumen recortado al ~90%.",
  red: "Poca recuperación: dosis recortada (~75% del volumen).",
};

const MOVE_SINGLES = "Mové los singles pesados, no los borres.";

const NONE: ReadinessModulation = {
  band: null,
  directive: "none",
  factor: null,
  headline: "Sin señal de readiness",
  rationale: "No hay monitoreo reciente para modular esta semana.",
  moveHeavySingles: false,
};

/**
 * El rationale legible del ajuste por readiness del `week`, o el "none" honesto si el motor corrió
 * sin banda (sin serie de monitoreo). Deriva del week: `factor === week.taper.readinessFactor` y
 * `moveHeavySingles === week.heavySinglesAdvisory` por construcción.
 */
export function readinessModulation(week: EngineWeek): ReadinessModulation {
  const band = week.inputs.readiness;
  if (band === null) return NONE;

  const moveHeavySingles = week.heavySinglesAdvisory;
  const rationale = moveHeavySingles ? `${RATIONALE[band]} ${MOVE_SINGLES}` : RATIONALE[band];

  return {
    band,
    directive: DIRECTIVE[band],
    factor: week.taper.readinessFactor,
    headline: HEADLINE[band],
    rationale,
    moveHeavySingles,
  };
}
