import type {
  Captura, Movement, MovementBase, MovementFlag, MovementModifiers, Origen, Posicion, TipoEnvion,
} from "../types";
import { MOVEMENT_BASES } from "../data/movements";

const POSICIONES: Posicion[] = ["alto", "rodilla", "bajo"];

/** Complexity 1..12: full-from-floor is hardest; power & blocks/hang lower it; pausa/déficit/tempo raise it. */
export function computeComplexity(baseComplexity: number, m: MovementModifiers): number {
  let c = baseComplexity;
  if (m.captura === "potencia") c -= 2;
  if (m.origen === "bloques" || m.origen === "colgado") c -= 1;
  if (m.posicion === "alto") c -= 1;
  if (m.tipoEnvion === "empuje" || m.tipoEnvion === "potencia") c -= 1;
  else if (m.tipoEnvion === "fuerza") c -= 2;
  for (const f of m.flags) {
    if (f === "pausa" || f === "deficit" || f === "tempo") c += 1;
    else if (f === "sin-recibida") c -= 1;
  }
  return Math.max(1, Math.min(12, c));
}

const TIPO_ENVION_LABEL: Record<TipoEnvion, string> = {
  tijera: "en tijera", empuje: "de empuje", potencia: "de potencia", fuerza: "de fuerza",
};
const FLAG_LABEL: Record<MovementFlag, string> = {
  pausa: "con pausa", deficit: "con déficit", tempo: "tempo", "sin-recibida": "sin recibida",
};

/** Spanish display name: base + (de potencia) + (origen/posición) + (tipoEnvión) + flags. Defaults (completo, piso) omitted. */
export function movementDisplayName(baseName: string, m: MovementModifiers): string {
  const parts: string[] = [baseName];
  if (m.captura === "potencia") parts.push("de potencia");
  if (m.origen === "bloques") parts.push(m.posicion ? `desde bloques (${m.posicion})` : "desde bloques");
  else if (m.origen === "colgado") parts.push(m.posicion ? `colgado (${m.posicion})` : "colgado");
  if (m.tipoEnvion) parts.push(TIPO_ENVION_LABEL[m.tipoEnvion]);
  for (const f of m.flags) parts.push(FLAG_LABEL[f]);
  return parts.join(" ");
}

/** Variant id: base + non-default modifiers (completo & piso omitted). Flags are NOT in the id. */
function movementId(baseId: string, m: MovementModifiers): string {
  const parts = [baseId];
  if (m.captura === "potencia") parts.push("potencia");
  if (m.origen === "bloques" || m.origen === "colgado") {
    parts.push(m.origen);
    if (m.posicion) parts.push(m.posicion);
  }
  if (m.tipoEnvion) parts.push(m.tipoEnvion);
  return parts.join(".");
}

/** Expand each base over its axes into concrete (flag-less) variants. Complete by construction. */
export function buildMovements(bases: MovementBase[]): Movement[] {
  const out: Movement[] = [];
  for (const base of bases) {
    const capturas: (Captura | undefined)[] = base.axes.captura ?? [undefined];
    const origenes: (Origen | undefined)[] = base.axes.origen ?? [undefined];
    const tipos: (TipoEnvion | undefined)[] = base.axes.tipoEnvion ?? [undefined];
    for (const captura of capturas) {
      for (const tipoEnvion of tipos) {
        for (const origen of origenes) {
          const posiciones: (Posicion | undefined)[] =
            origen === "bloques" || origen === "colgado" ? POSICIONES : [undefined];
          for (const posicion of posiciones) {
            const modifiers: MovementModifiers = { flags: [] };
            if (captura) modifiers.captura = captura;
            if (origen) modifiers.origen = origen;
            if (posicion) modifiers.posicion = posicion;
            if (tipoEnvion) modifiers.tipoEnvion = tipoEnvion;
            out.push({
              id: movementId(base.id, modifiers),
              baseId: base.id,
              name: movementDisplayName(base.name, modifiers),
              rmRef: base.rmRef,
              complexity: computeComplexity(base.baseComplexity, modifiers),
              modifiers,
            });
          }
        }
      }
    }
  }
  return out;
}

/** The generated catalog. */
export const MOVEMENTS: Movement[] = buildMovements(MOVEMENT_BASES);

const BY_ID = new Map<string, Movement>(MOVEMENTS.map((m) => [m.id, m]));

/** Look up a generated variant by id. */
export function getMovement(id: string): Movement | undefined {
  return BY_ID.get(id);
}

// ── Query helpers ──────────────────────────────────────────────────────────────

import type { RmRef } from "../types";

const BASE_BY_ID = new Map<string, MovementBase>(MOVEMENT_BASES.map((b) => [b.id, b]));

export function getBase(baseId: string): MovementBase | undefined {
  return BASE_BY_ID.get(baseId);
}

/** All variants of a base, sorted by complexity descending (most complex first). */
export function variantsOf(baseId: string): Movement[] {
  return MOVEMENTS.filter((m) => m.baseId === baseId).sort((a, b) => b.complexity - a.complexity);
}

/** The representative variant of a base (most complex: full-from-floor / split jerk / the single squat). */
export function canonicalVariant(baseId: string): Movement | undefined {
  return variantsOf(baseId)[0];
}

/** Same base, strictly lower complexity — i.e. "bajar la complejidad". Sorted by complexity desc. */
export function simplerVariants(id: string): Movement[] {
  const m = getMovement(id);
  if (!m) return [];
  return variantsOf(m.baseId).filter((v) => v.complexity < m.complexity);
}

/** Curated substitutes: the canonical variant of each of the base's substituteBases. */
export function substitutesOf(id: string): Movement[] {
  const m = getMovement(id);
  if (!m) return [];
  const base = getBase(m.baseId);
  if (!base) return [];
  return base.substituteBases
    .map((b) => canonicalVariant(b))
    .filter((x): x is Movement => x !== undefined);
}

export function movementsForRm(rmRef: RmRef): Movement[] {
  return MOVEMENTS.filter((m) => m.rmRef === rmRef);
}

const norm = (s: string): string =>
  s.toLowerCase()
    .replace(/[áàä]/g, "a").replace(/[éèë]/g, "e").replace(/[íìï]/g, "i")
    .replace(/[óòö]/g, "o").replace(/[úùü]/g, "u"); // accent-insensitive (composed chars, transcription-safe)

/** English search tokens for a variant (so "hang power snatch" matches the Spanish-named variant). */
function enTokens(m: Movement, base: MovementBase | undefined): string {
  const t: string[] = [base?.aliasEn ?? ""];
  const mod = m.modifiers;
  if (mod.captura === "potencia") t.push("power");
  if (mod.origen === "colgado") t.push("hang");
  if (mod.origen === "bloques") t.push("block blocks");
  if (mod.posicion === "alto") t.push("above knee");
  if (mod.posicion === "rodilla") t.push("knee");
  if (mod.posicion === "bajo") t.push("below knee");
  if (mod.tipoEnvion === "tijera") t.push("split");
  if (mod.tipoEnvion === "empuje") t.push("push");
  if (mod.tipoEnvion === "potencia") t.push("power");
  if (mod.tipoEnvion === "fuerza") t.push("strict");
  for (const f of mod.flags) t.push(f === "pausa" ? "pause" : f === "sin-recibida" ? "no catch" : f);
  return t.join(" ");
}

/** Multi-term, accent-insensitive search over the Spanish name + English tokens. Empty query → []. */
export function searchMovements(q: string): Movement[] {
  const terms = norm(q).split(/\s+/).filter(Boolean);
  if (terms.length === 0) return [];
  return MOVEMENTS.filter((m) => {
    const hay = norm(`${m.name} ${enTokens(m, getBase(m.baseId))}`);
    return terms.every((t) => hay.includes(t));
  });
}
