/**
 * Nombre de movimiento/complejo LOCALIZADO — capa de presentación (el core sigue devolviendo
 * datos+ids; acá se proyecta el nombre por idioma de NOMENCLATURA, que es un toggle INDEPENDIENTE
 * del idioma de UI: un atleta puede leer la UI en español y los nombres en inglés (snatch, C&J).
 *
 * - ES: se delega en `programmableName` del core (mismo string que hoy) → cero cambios para es.
 * - EN: se COMPONE desde `aliasEn` de la base + modificadores en el ORDEN del inglés
 *   ("hang power snatch", no "snatch de potencia desde colgado"). Glosario §4.
 * - PT-BR: nomenclatura PENDIENTE de revisión de hablante nativo (glosario §2b/§6) → NO se cablea
 *   todavía (el toggle es auto/es/en). Las claves PT viven listas en `PT_ALIAS_PENDING` para
 *   cuando se active, pero hoy NO se muestran.
 *
 * Los flags (pausa/déficit/tempo/sin-recibida) NO aparecen en las recetas/seeds (verificado), así
 * que reconstruir el nombre desde el `movementId` es sin pérdida respecto del nombre horneado.
 */
import {
  getMovement, getBase, getComplex, isComplexId, programmableName,
  type MovementModifiers,
} from "@holy-oly/core";

/** Tokens EN de los modificadores (glosario §4). El orden gramatical lo arma `composeEn`. */
const EN_JERK: Record<string, string> = { tijera: "split", empuje: "push", potencia: "power", fuerza: "strict" };
const EN_POS: Record<string, string> = { alto: "above knee", rodilla: "knee", bajo: "below knee" };
const EN_FLAG: Record<string, string> = { pausa: "paused", deficit: "deficit", tempo: "tempo", "sin-recibida": "no-catch" };

/** Nombres EN de los complejos (curados; el core sólo tiene el ES). Notación universal (2+1) intacta. */
const EN_COMPLEX: Record<string, string> = {
  "cx.tiron-arranque+arranque": "Snatch pull + Snatch (2+1)",
  "cx.arranque+ohs": "Snatch + Overhead squat (1+2)",
  "cx.arranque-potencia+arranque": "Power snatch + Snatch (1+1)",
  "cx.arranque-colgado+arranque": "Hang snatch + Snatch (1+1)",
  "cx.tiron-arranque+arranque+ohs": "Snatch pull + Snatch + Overhead squat (1+1+1)",
  "cx.cargada+frontal+2t": "Clean + Front squat + Jerk (1+1+1)",
  "cx.cargada+2t-doble": "Clean + Jerk ×2 (1+2)",
  "cx.tiron-cargada+cargada": "Clean pull + Clean (2+1)",
  "cx.cargada-potencia+frontal": "Power clean + Front squat (1+2)",
  "cx.press-empuje+2t": "Push press + Jerk (1+1)",
};

/**
 * Alias PT-BR de las bases — PENDIENTE de revisión de hablante nativo (glosario §2b). NO se usa
 * todavía (el toggle de nomenclatura es auto/es/en). Listo para cuando se active el PT de movimientos.
 */
export const PT_ALIAS_PENDING: Record<string, string> = {
  arranque: "Arranco", cargada: "Clean", envion: "Segundo tempo", "cargada-envion": "Arremesso",
  "tiron-arranque": "Puxada de arranco", "tiron-cargada": "Puxada de clean",
  sentadilla: "Agachamento", "sentadilla-frente": "Agachamento frontal", "sentadilla-overhead": "Agachamento sobre a cabeça",
  "press-empuje": "Push press", "press-hombros": "Desenvolvimento militar", "peso-muerto-rumano": "Levantamento terra romeno",
  "buenos-dias": "Bom dia", remo: "Remada curvada", "snatch-balance": "Snatch balance",
  "jerk-dip": "Dip do arremesso", "sots-press": "Sots press", "remo-menton": "Remada alta",
  "press-banca": "Supino", hiperextension: "Hiperextensão", "salto-cajon": "Salto na caixa",
};

/** Nombre EN compuesto: modificadores ANTES de la base (orden inglés "hang power snatch") + posición/
 *  flags. Se arma en minúscula (convención de gimnasio) y se capitaliza la primera letra (sentence-case). */
function composeEn(aliasEn: string, m: MovementModifiers): string {
  const parts: string[] = [];
  for (const f of m.flags) parts.push(EN_FLAG[f] ?? f); // hoy vacío (sin flags en datos); listo igual
  if (m.origen === "colgado") parts.push("hang");
  else if (m.origen === "bloques") parts.push("block");
  if (m.captura === "potencia") parts.push("power");
  if (m.tipoEnvion) parts.push(EN_JERK[m.tipoEnvion] ?? m.tipoEnvion);
  parts.push(aliasEn.toLowerCase());
  let name = parts.join(" ");
  if (m.posicion && (m.origen === "colgado" || m.origen === "bloques")) name += ` (${EN_POS[m.posicion] ?? m.posicion})`;
  return name.charAt(0).toUpperCase() + name.slice(1);
}

/**
 * Nombre localizado de un id programable (variante de movimiento o complejo `cx.*`).
 * `lang` es el idioma de NOMENCLATURA resuelto (es/en). Cualquier valor ≠ "en" cae al ES del core.
 */
export function composeMovementName(id: string, lang: "es" | "en"): string {
  if (lang !== "en") return programmableName(id); // es (y pt hasta cablearse) → string del core
  if (isComplexId(id)) return EN_COMPLEX[id] ?? getComplex(id)?.name ?? id;
  const mv = getMovement(id);
  if (!mv) return id;
  const base = getBase(mv.baseId);
  return composeEn(base?.aliasEn ?? base?.name ?? mv.name, mv.modifiers);
}
