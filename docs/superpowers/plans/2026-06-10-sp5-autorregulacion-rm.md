# SP5 — Autorregulación / vigencia de RM — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Actualizar `Plan.rms` a mitad de ciclo (cascada automática de kg, prescripción intacta), historial append-only `RmUpdate` con vigencia ("fijado hace N sem"), y detección de PRs del atleta que el coach confirma — todo en el drill-down del coach.

**Architecture:** Core puro (`logic/rm.ts`: `prCandidates` + `rmVigencia`) + tabla `RmUpdate` (migración **16** — la 15 la tiene el WIP booking del checkout principal) + 3 endpoints coach-only (`guardAthlete`/`guardAthleteWrite`) + `Repository` (Http/Local) + sección `RmSection` en `Drilldown`. `updateRms` NO re-instancia la prescripción: el kg se deriva en lectura (`rms × pct`), así las ediciones del coach sobreviven y el "repercute" es gratis.

**Tech Stack:** TypeScript monorepo pnpm (core/api/web), Prisma + Postgres embebido, Fastify, Zod, React + vitest/RTL.

**Spec:** `docs/superpowers/specs/2026-06-05-sp5-autorregulacion-rm-design.md` (deltas 06-08 aplicados; ver §Decisiones abajo).

---

## Decisiones que este plan fija (deltas sobre el spec)

1. **Migración `16_rm_history`** (el spec decía 10→15; la 15 está tomada por el WIP booking sin commitear del checkout principal — handoff 2026-06-10).
2. **PR = estricto `actualKg > rms[lift]`** (el spec escribe `>=` en §3.2, pero §2/§3.5 exigen que confirmar el PR lo **auto-resuelva**; con `>=`, confirmar al mismo kg dejaría el candidato pegado para siempre. Dominio: un récord SUPERA la marca; igualarla no es PR). Documentado para El Carnicero (§8 del spec lo deja a su juicio).
3. **`RmUpdate.createdAt`** en el modelo (no está en el spec): dos updates el mismo día necesitan orden estable (`orderBy [setAt desc, createdAt desc]`). Consistente con Vinculo/Athlete.
4. **`RmSection` carga sus propios datos** (candidates + history) con error honesto + retry, como `PlanMapSection` — en vez de engordar el `Promise.all` del Drilldown (el spec sugería Promise.all; el patrón lazy-section ya existe en el repo y aísla fallos).
5. **Audit:** `PUT /athletes/:id/rms` registra `action: "rms.write"` (toda escritura de coach se audita en este server; el spec no lo menciona pero el patrón manda).
6. **Updates duplicados por lift** en un body → rechazados por Zod (`refine`): historial sin ambigüedad.
7. **Tras updateRms, la UI remonta `SessionsSection` y `PlanCalendar`** (key con `rmsStamp`) para que el kg derivado ya cacheado se refresque honesto.

## No-negociables (rulebook `docs/domain/HOLY-OLY-DOMAIN.md`)

- **kg = verdad**; el kg sigue derivándose de `rms × pct` — subir el RM recae solo. **Sin RPE en ninguna superficie del atleta** (esta feature es 100% coach-territory; el atleta no ve nada nuevo).
- **El atleta no ve RMs** (los endpoints son coach-only: atleta→401, coach sin Vínculo→403).
- **Sin-dato honesto**: sin plan → sin sección; sin historial → vigencia cae a `plan.startDate`; sin `startDate` → "—", nunca inventar.
- **Discos**: esta feature no toca discos (panel de números del coach). Los kg que el atleta ve siguen llevando `DiscRow` (sin cambios).

## Preflight (ya hecho en esta sesión / verificar)

- Worktree `nifty-lumiere-6f1195`, rama `claude/nifty-lumiere-6f1195` == main local `a673dca`. `pnpm install` + `prisma generate` corridos.
- NO tocar el checkout principal `C:\Holy Oly 0017` (WIP booking ajeno) salvo el FF final con stash-dance.
- NO pushear `origin/main` jamás.

---

### Task 1: Core — tipos + schemas Zod (RmLift/RmUpdate/PrCandidate/UpdateRmsInput)

**Files:**
- Modify: `packages/core/src/types/index.ts` (al final, después de `WarmupSet`)
- Modify: `packages/core/src/schemas.ts` (al final)
- Create: `packages/core/src/schemas.rm.test.ts`

- [ ] **Step 1.1: Write the failing test** — `packages/core/src/schemas.rm.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { UpdateRmsInputSchema, RmUpdateSchema, PrCandidateSchema } from "./schemas";

describe("UpdateRmsInputSchema (input del coach, acotado)", () => {
  const ok = { updates: [{ lift: "arranque", kg: 92 }], reason: "manual" };

  it("acepta 1..4 updates con lifts válidos y kg en rango", () => {
    expect(UpdateRmsInputSchema.safeParse(ok).success).toBe(true);
    expect(UpdateRmsInputSchema.safeParse({
      updates: [
        { lift: "arranque", kg: 92 }, { lift: "envion", kg: 115 },
        { lift: "sentadilla", kg: 150 }, { lift: "frente", kg: 125 },
      ], reason: "pr",
    }).success).toBe(true);
  });

  it("rechaza 0 updates y más de 4", () => {
    expect(UpdateRmsInputSchema.safeParse({ updates: [], reason: "manual" }).success).toBe(false);
    const five = Array.from({ length: 5 }, () => ({ lift: "arranque", kg: 90 }));
    expect(UpdateRmsInputSchema.safeParse({ updates: five, reason: "manual" }).success).toBe(false);
  });

  it("rechaza kg fuera de rango (0, negativo, >500) y lift inválido", () => {
    expect(UpdateRmsInputSchema.safeParse({ updates: [{ lift: "arranque", kg: 0 }], reason: "manual" }).success).toBe(false);
    expect(UpdateRmsInputSchema.safeParse({ updates: [{ lift: "arranque", kg: -5 }], reason: "manual" }).success).toBe(false);
    expect(UpdateRmsInputSchema.safeParse({ updates: [{ lift: "arranque", kg: 501 }], reason: "manual" }).success).toBe(false);
    expect(UpdateRmsInputSchema.safeParse({ updates: [{ lift: "press-banca", kg: 90 }], reason: "manual" }).success).toBe(false);
  });

  it('rechaza reason "assign" (sólo lo escribe savePlan) y lifts duplicados', () => {
    expect(UpdateRmsInputSchema.safeParse({ updates: [{ lift: "arranque", kg: 90 }], reason: "assign" }).success).toBe(false);
    expect(UpdateRmsInputSchema.safeParse({
      updates: [{ lift: "arranque", kg: 90 }, { lift: "arranque", kg: 95 }], reason: "manual",
    }).success).toBe(false);
  });
});

describe("RmUpdateSchema / PrCandidateSchema (wire)", () => {
  it("valida una fila de historial", () => {
    expect(RmUpdateSchema.safeParse({ lift: "envion", kg: 110, setAt: "2026-06-10", reason: "pr" }).success).toBe(true);
    expect(RmUpdateSchema.safeParse({ lift: "envion", kg: 110, setAt: "hoy", reason: "pr" }).success).toBe(false);
  });
  it("valida un candidato a PR", () => {
    expect(PrCandidateSchema.safeParse({
      lift: "arranque", movementId: "arranque.potencia", movementName: "Arranque de potencia",
      kg: 95, week: 3, sessionIdx: 0,
    }).success).toBe(true);
  });
});
```

- [ ] **Step 1.2: Run it — must FAIL** (símbolos no existen):

Run: `pnpm --filter @holy-oly/core test -- schemas.rm`
Expected: FAIL — `UpdateRmsInputSchema` is not exported.

- [ ] **Step 1.3: Types** — append a `packages/core/src/types/index.ts` (después del bloque `WarmupSet`, línea ~247):

```ts
// ── SP5 autorregulación: historial de RMs + detección de PR (coach-territory). ──
/** Los 4 lifts con RM (= keyof RM; sin "none"). */
export type RmLift = "arranque" | "envion" | "sentadilla" | "frente";
/** Por qué se fijó un RM: baseline al asignar, edición manual del coach, o confirmación de PR. */
export type RmReason = "assign" | "manual" | "pr";
/** Una fila del historial append-only de RMs (la curva del 1RM). `setAt` ISO YYYY-MM-DD. */
export interface RmUpdate { lift: RmLift; kg: number; setAt: string; reason: RmReason; }
/** Set hecho que SUPERA el RM vigente del lift (rmRef del movimiento) — sugerencia al coach. */
export interface PrCandidate { lift: RmLift; movementId: string; movementName: string; kg: number; week: number; sessionIdx: number; }
/** Vigencia por lift: cuándo se fijó y hace cuántas semanas ({} = sin dato, nunca inventar). */
export type RmVigencia = Record<RmLift, { setAt?: string; weeksAgo?: number }>;
```

- [ ] **Step 1.4: Schemas** — append a `packages/core/src/schemas.ts`:

```ts
// ── SP5 RMs: historial + PRs. El INPUT del coach va acotado (KgSchema, 1..4, sin duplicados);
//    las lecturas validan shape (el server ya acotó al escribir). ──
export const RmLiftSchema = z.enum(["arranque", "envion", "sentadilla", "frente"]);
export const RmReasonSchema = z.enum(["assign", "manual", "pr"]);

export const RmUpdateSchema = z.object({
  lift: RmLiftSchema,
  kg: z.number().positive(),
  setAt: IsoDateSchema,
  reason: RmReasonSchema,
});
export const RmUpdatesSchema = z.array(RmUpdateSchema).max(5000);

export const PrCandidateSchema = z.object({
  lift: RmLiftSchema,
  movementId: z.string(),
  movementName: z.string(),
  kg: z.number().positive(),
  week: z.number().int().min(1).max(104),
  sessionIdx: z.number().int().min(0).max(13),
});
export const PrCandidatesSchema = z.array(PrCandidateSchema).max(4);

export const UpdateRmsInputSchema = z.object({
  // "assign" no es input del coach — sólo lo escribe savePlan al asignar.
  updates: z
    .array(z.object({ lift: RmLiftSchema, kg: KgSchema }))
    .min(1)
    .max(4)
    .refine((u) => new Set(u.map((x) => x.lift)).size === u.length, "lift duplicado"),
  reason: z.enum(["manual", "pr"]),
});
```

- [ ] **Step 1.5: Run — must PASS:**

Run: `pnpm --filter @holy-oly/core test -- schemas.rm`
Expected: PASS (todos los casos).

- [ ] **Step 1.6: Commit**

```bash
git add packages/core/src/types/index.ts packages/core/src/schemas.ts packages/core/src/schemas.rm.test.ts
git commit -m "feat(core): tipos + schemas RmUpdate/PrCandidate/UpdateRmsInput (SP5)"
```

---

### Task 2: Core — `logic/rm.ts` (`prCandidates` + `rmVigencia`)

**Files:**
- Create: `packages/core/src/logic/rm.ts`
- Create: `packages/core/src/logic/rm.test.ts`
- Modify: `packages/core/src/index.ts` (export)

Notas de dominio para los tests: el catálogo NO tiene movimientos `rmRef:"none"` hoy (el guard queda por future-proofing; el caso "se ignora" se testea con un movementId desconocido). `getMovement("arranque").rmRef === "arranque"`; la variante `"arranque.potencia"` también referencia `arranque`; `"sentadilla-frente"` → `frente`.

- [ ] **Step 2.1: Write the failing test** — `packages/core/src/logic/rm.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { prCandidates, rmVigencia, RM_LIFTS } from "./rm";
import type { RM, RmUpdate, SessionActual } from "../types";

const RMS: RM = { arranque: 80, envion: 100, sentadilla: 140, frente: 110 };
const base = { week: 1, sessionIdx: 0, order: 0, done: true } as const;

describe("prCandidates", () => {
  it("set hecho con kg > RM del rmRef → candidato (con nombre del movimiento)", () => {
    const out = prCandidates([{ ...base, movementId: "arranque", actualKg: 85 }], RMS);
    expect(out).toEqual([{ lift: "arranque", movementId: "arranque", movementName: "Arranque", kg: 85, week: 1, sessionIdx: 0 }]);
  });

  it("estricto: igualar el RM NO es PR (auto-resuelve al confirmar)", () => {
    expect(prCandidates([{ ...base, movementId: "arranque", actualKg: 80 }], RMS)).toEqual([]);
  });

  it("la variante cuenta contra el RM de su lift base (arranque.potencia ≥ RM arranque)", () => {
    const out = prCandidates([{ ...base, movementId: "arranque.potencia", actualKg: 82 }], RMS);
    expect(out).toHaveLength(1);
    expect(out[0]!.lift).toBe("arranque");
    expect(out[0]!.movementName).toMatch(/potencia/i);
  });

  it("ignora no-hechos, sin kg, y movimientos desconocidos", () => {
    expect(prCandidates([
      { ...base, movementId: "arranque", actualKg: 95, done: false },
      { ...base, movementId: "arranque" }, // sin actualKg
      { ...base, movementId: "movimiento-inventado", actualKg: 999 },
    ], RMS)).toEqual([]);
  });

  it("por lift devuelve sólo el de mayor kg; empate → el más reciente (semana mayor)", () => {
    const out = prCandidates([
      { ...base, movementId: "arranque", actualKg: 85 },
      { ...base, week: 2, movementId: "arranque.potencia", actualKg: 88 },
      { ...base, week: 3, movementId: "arranque", actualKg: 88 },
    ], RMS);
    expect(out).toHaveLength(1);
    expect(out[0]!.kg).toBe(88);
    expect(out[0]!.week).toBe(3);
  });

  it("≤ 4 candidatos, en orden estable de lifts (arranque, envion, sentadilla, frente)", () => {
    const out = prCandidates([
      { ...base, movementId: "sentadilla", actualKg: 150 },
      { ...base, movementId: "arranque", actualKg: 85 },
      { ...base, movementId: "envion", actualKg: 105 },
      { ...base, movementId: "sentadilla-frente", actualKg: 115 },
    ], RMS);
    expect(out.map((c) => c.lift)).toEqual(["arranque", "envion", "sentadilla", "frente"]);
  });
});

describe("rmVigencia", () => {
  const H = (lift: RmUpdate["lift"], setAt: string): RmUpdate => ({ lift, kg: 100, setAt, reason: "manual" });

  it("toma la última RmUpdate por lift", () => {
    const v = rmVigencia([H("arranque", "2026-05-01"), H("arranque", "2026-06-01")], undefined, "2026-06-10");
    expect(v.arranque).toEqual({ setAt: "2026-06-01", weeksAgo: 1 });
  });

  it("sin historial cae a fallbackDate (planes pre-SP5 → startDate)", () => {
    const v = rmVigencia([], "2026-04-01", "2026-06-10");
    for (const lift of RM_LIFTS) expect(v[lift]).toEqual({ setAt: "2026-04-01", weeksAgo: 10 });
  });

  it("sin historial ni fallback → {} (sin-dato honesto, nunca inventar)", () => {
    const v = rmVigencia([], undefined, "2026-06-10");
    for (const lift of RM_LIFTS) expect(v[lift]).toEqual({});
  });

  it("weeksAgo = floor(días/7), nunca negativo (setAt futuro → 0)", () => {
    expect(rmVigencia([H("envion", "2026-06-04")], undefined, "2026-06-10").envion.weeksAgo).toBe(0);
    expect(rmVigencia([H("envion", "2026-06-03")], undefined, "2026-06-10").envion.weeksAgo).toBe(1);
    expect(rmVigencia([H("envion", "2026-07-01")], undefined, "2026-06-10").envion.weeksAgo).toBe(0);
  });

  it("mezcla: un lift con historial, el resto al fallback", () => {
    const v = rmVigencia([H("frente", "2026-06-08")], "2026-04-01", "2026-06-10");
    expect(v.frente).toEqual({ setAt: "2026-06-08", weeksAgo: 0 });
    expect(v.arranque).toEqual({ setAt: "2026-04-01", weeksAgo: 10 });
  });
});
```

- [ ] **Step 2.2: Run — must FAIL** (`./rm` no existe):

Run: `pnpm --filter @holy-oly/core test -- logic/rm`
Expected: FAIL — cannot resolve `./rm`.

- [ ] **Step 2.3: Implement** — `packages/core/src/logic/rm.ts`:

```ts
/**
 * SP5 — autorregulación del RM. Puro y determinista (el caller pasa "today").
 * PR = set HECHO cuyo kg SUPERA (estricto) el RM vigente del lift del movimiento (rmRef):
 * estricto para que confirmar el PR (subir el RM a ese kg) lo auto-resuelva — igualar el
 * RM no es un récord. La variante cuenta contra su lift base; el coach juzga y entra el
 * valor final (acá no se auto-calcula 1RM por reps, jamás).
 */
import type { PrCandidate, RM, RmLift, RmUpdate, RmVigencia, SessionActual } from "../types";
import { getMovement } from "./movements";

/** Orden canónico de lifts (= orden de la planilla del coach). */
export const RM_LIFTS: readonly RmLift[] = ["arranque", "envion", "sentadilla", "frente"];

const DAY = 86_400_000;
const ms = (iso: string): number => new Date(`${iso}T00:00:00Z`).getTime();

/** Por lift, el candidato de mayor kg (empate → el más reciente). ≤4, orden RM_LIFTS. */
export function prCandidates(actuals: SessionActual[], rms: RM): PrCandidate[] {
  const best = new Map<RmLift, PrCandidate>();
  for (const a of actuals) {
    if (!a.done || a.actualKg == null) continue;
    const mv = getMovement(a.movementId);
    if (!mv || mv.rmRef === "none") continue;
    const lift = mv.rmRef;
    if (a.actualKg <= rms[lift]) continue;
    const cur = best.get(lift);
    if (!cur || a.actualKg > cur.kg || (a.actualKg === cur.kg && a.week > cur.week)) {
      best.set(lift, { lift, movementId: mv.id, movementName: mv.name, kg: a.actualKg, week: a.week, sessionIdx: a.sessionIdx });
    }
  }
  return RM_LIFTS.flatMap((l) => { const c = best.get(l); return c ? [c] : []; });
}

/** Por lift: el `setAt` de la última RmUpdate; sin historial cae a `fallbackDate`
 *  (= plan.startDate, "fijado al asignar"); sin nada → {}. weeksAgo = floor(días/7), ≥0. */
export function rmVigencia(history: RmUpdate[], fallbackDate: string | undefined, today: string): RmVigencia {
  const out = {} as RmVigencia;
  for (const lift of RM_LIFTS) {
    let last: string | undefined;
    for (const h of history) if (h.lift === lift && (last == null || h.setAt > last)) last = h.setAt;
    const setAt = last ?? fallbackDate;
    out[lift] = setAt == null ? {} : { setAt, weeksAgo: Math.max(0, Math.floor((ms(today) - ms(setAt)) / DAY / 7)) };
  }
  return out;
}
```

- [ ] **Step 2.4: Export** — en `packages/core/src/index.ts` agregar (después de `./logic/planHeat`):

```ts
export * from "./logic/rm";
```

- [ ] **Step 2.5: Run — must PASS** + suite completa de core:

Run: `pnpm --filter @holy-oly/core test`
Expected: PASS (171 existentes + ~16 nuevos).

- [ ] **Step 2.6: Commit**

```bash
git add packages/core/src/logic/rm.ts packages/core/src/logic/rm.test.ts packages/core/src/index.ts
git commit -m "feat(core): prCandidates (PR estricto >) + rmVigencia (SP5)"
```

---

### Task 3: API — modelo `RmUpdate` + migración 16

**Files:**
- Modify: `apps/api/prisma/schema.prisma` (modelo nuevo + relación en Athlete)
- Create: `apps/api/prisma/migrations/16_rm_history/migration.sql` (generada por tool)

- [ ] **Step 3.1: Schema** — en `apps/api/prisma/schema.prisma`:

(a) en `model Athlete`, después de `actuals SessionActual[]` (línea ~201):

```prisma
  rmUpdates    RmUpdate[]
```

(b) al final del archivo, después de `model PrescribedExercise`:

```prisma
/// Historial append-only de RMs (SP5). Cada cambio de Plan.rms escribe una fila acá (mismo
/// valor) — la última por lift coincide con Plan.rms. `reason`: assign (baseline al asignar) |
/// manual (edición del coach) | pr (confirmación de un PR). `setAt` ISO YYYY-MM-DD.
model RmUpdate {
  id        String   @id @default(uuid())
  athleteId String
  athlete   Athlete  @relation(fields: [athleteId], references: [id], onDelete: Cascade)
  lift      String
  kg        Float
  setAt     String
  reason    String
  createdAt DateTime @default(now())

  @@index([athleteId])
}
```

- [ ] **Step 3.2: Generar la migración** (no-Docker, PG embebido — mata zombis `postgres.exe` si da 10048):

Run: `pnpm --filter @holy-oly/api exec tsx scripts/make-migration.ts 16 rm_history`
Expected: `✅ Wrote prisma/migrations/16_rm_history/migration.sql` con `CREATE TABLE "RmUpdate"` + index + FK.

- [ ] **Step 3.3: Regenerar el cliente:**

Run: `pnpm --filter @holy-oly/api exec prisma generate`
Expected: OK; `prisma.rmUpdate` existe.

- [ ] **Step 3.4: Commit**

```bash
git add apps/api/prisma/schema.prisma apps/api/prisma/migrations/16_rm_history/migration.sql
git commit -m "feat(api): tabla RmUpdate (migracion 16_rm_history, SP5)"
```

---

### Task 4: API — int tests primero (RED), repo + endpoints después (GREEN)

**Files:**
- Create: `apps/api/src/rm.int.test.ts`
- Modify: `apps/api/src/repo.ts` (mapper compartido + `updateRms`/`getPrCandidates`/`getRmHistory` + baseline en `savePlan`)
- Modify: `apps/api/src/server.ts` (3 endpoints + `todayISO` + savePlan con today)

Contexto de la suite int: corre vía `pnpm --filter @holy-oly/api verify` (PG embebido :5433, migrate deploy + seed + vitest int). Atletas seed: `mv` = login `mara@holyoly.dev`; coach `coach@holyoly.dev` (password `holyoly-demo`). Otros archivos int re-PUTean el plan de `mv` al empezar — este test hace lo mismo y NO necesita restaurar nada (cada archivo establece su propio estado; el historial RmUpdate crece append-only y nadie más lo lee).

- [ ] **Step 4.1: Write the failing int test** — `apps/api/src/rm.int.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildServer } from "./server";
import { prisma } from "./db/client";

type InjectRes = { cookies: Array<{ name: string; value: string }>; statusCode: number };
function sess(res: InjectRes): { cookie: string } {
  const c = res.cookies.find((x) => x.name === "session");
  if (!c) throw new Error("no session cookie");
  return { cookie: `session=${c.value}` };
}
// kg únicos de este archivo para que los filtros del historial no choquen con otros archivos.
const RMS = { arranque: 81, envion: 101, sentadilla: 141, frente: 111 };
const START = "2026-03-04";
const PLAN = { atletaId: "mv", macroId: "ruso-5d", startWeek: 1, startDate: START, rms: RMS, comps: [] };

interface HistRow { lift: string; kg: number; setAt: string; reason: string }
interface Candidate { lift: string; movementId: string; movementName: string; kg: number; week: number; sessionIdx: number }

describe("API integration — RMs (SP5: updateRms / historial / PRs)", () => {
  let app: FastifyInstance;
  beforeAll(async () => { app = buildServer(); await app.ready(); });
  afterAll(async () => { await app.close(); await prisma.$disconnect(); });

  const login = async (email: string) => {
    const res = await app.inject({ method: "POST", url: "/auth/login", payload: { email, password: "holyoly-demo" } });
    expect(res.statusCode).toBe(200);
    return sess(res);
  };

  it("savePlan siembra 4 baselines (reason assign, setAt = startDate)", async () => {
    const coach = await login("coach@holyoly.dev");
    expect((await app.inject({ method: "PUT", url: "/athletes/mv/plan", headers: coach, payload: PLAN })).statusCode).toBe(200);

    const res = await app.inject({ method: "GET", url: "/athletes/mv/rm-history", headers: coach });
    expect(res.statusCode).toBe(200);
    const hist = res.json() as HistRow[];
    const baselines = hist.filter((h) => h.reason === "assign" && h.setAt === START && h.kg >= 81 && h.kg <= 141);
    expect(new Set(baselines.map((b) => b.lift))).toEqual(new Set(["arranque", "envion", "sentadilla", "frente"]));
    expect(baselines.find((b) => b.lift === "arranque")!.kg).toBe(81);
  });

  it("PUT rms: cascada de kg + prescripción intacta (la edición del coach sobrevive) + historial al frente", async () => {
    const coach = await login("coach@holyoly.dev");
    await app.inject({ method: "PUT", url: "/athletes/mv/plan", headers: coach, payload: PLAN });

    // El coach edita la sesión 1/0 a mano — updateRms NO debe pisarla (no re-instanciar).
    expect((await app.inject({ method: "PUT", url: "/athletes/mv/prescription/1/0", headers: coach,
      payload: [{ movementId: "sentadilla", sets: 5, reps: 5, pct: 70 }] })).statusCode).toBe(200);

    const put = await app.inject({ method: "PUT", url: "/athletes/mv/rms", headers: coach,
      payload: { updates: [{ lift: "sentadilla", kg: 160 }], reason: "manual" } });
    expect(put.statusCode).toBe(200);

    // Plan refleja el RM nuevo; los demás lifts intactos.
    const plan = (await app.inject({ method: "GET", url: "/athletes/mv/plan", headers: coach })).json() as { rms: Record<string, number> };
    expect(plan.rms.sentadilla).toBe(160);
    expect(plan.rms.arranque).toBe(81);

    // Cascada: el kg derivado de la sesión EDITADA usa el RM nuevo (70% de 160 = 112), y la edición sobrevivió.
    const week = (await app.inject({ method: "GET", url: "/athletes/mv/prescription?week=1", headers: coach }))
      .json() as Array<{ sessionIdx: number; exercises: Array<{ movementId: string; sets: number; targetKg?: number }> }>;
    const s0 = week.find((s) => s.sessionIdx === 0)!;
    expect(s0.exercises).toHaveLength(1);
    expect(s0.exercises[0]!.movementId).toBe("sentadilla");
    expect(s0.exercises[0]!.sets).toBe(5);
    expect(s0.exercises[0]!.targetKg).toBe(112);

    // Historial: la fila nueva (manual, hoy) viene primero (orden desc).
    const hist = (await app.inject({ method: "GET", url: "/athletes/mv/rm-history", headers: coach })).json() as HistRow[];
    expect(hist[0]).toMatchObject({ lift: "sentadilla", kg: 160, reason: "manual" });
  });

  it("PR: el atleta levanta > RM → candidato; confirmar (subir el RM) lo auto-resuelve", async () => {
    const coach = await login("coach@holyoly.dev");
    await app.inject({ method: "PUT", url: "/athletes/mv/plan", headers: coach, payload: PLAN });

    const athlete = await login("mara@holyoly.dev");
    expect((await app.inject({ method: "PUT", url: "/me/session/2/0", headers: athlete,
      payload: [{ order: 0, movementId: "arranque.potencia", done: true, kg: 86, reps: 1 }] })).statusCode).toBe(200);

    let cands = (await app.inject({ method: "GET", url: "/athletes/mv/pr-candidates", headers: coach })).json() as Candidate[];
    const arr = cands.find((c) => c.lift === "arranque")!;
    expect(arr).toBeDefined();
    expect(arr.kg).toBe(86);
    expect(arr.week).toBe(2);
    expect(arr.movementName).toMatch(/potencia/i);

    // Confirmar: el coach entra el valor final (88) con reason "pr" → el candidato desaparece (86 > 88 es falso).
    expect((await app.inject({ method: "PUT", url: "/athletes/mv/rms", headers: coach,
      payload: { updates: [{ lift: "arranque", kg: 88 }], reason: "pr" } })).statusCode).toBe(200);
    cands = (await app.inject({ method: "GET", url: "/athletes/mv/pr-candidates", headers: coach })).json() as Candidate[];
    expect(cands.find((c) => c.lift === "arranque")).toBeUndefined();

    const hist = (await app.inject({ method: "GET", url: "/athletes/mv/rm-history", headers: coach })).json() as HistRow[];
    expect(hist[0]).toMatchObject({ lift: "arranque", kg: 88, reason: "pr" });
  });

  it("authz: sin sesión 401; sesión de atleta 401; coach sin Vínculo 403", async () => {
    expect((await app.inject({ method: "GET", url: "/athletes/mv/rm-history" })).statusCode).toBe(401);
    expect((await app.inject({ method: "GET", url: "/athletes/mv/pr-candidates" })).statusCode).toBe(401);

    const athlete = await login("mara@holyoly.dev");
    expect((await app.inject({ method: "PUT", url: "/athletes/mv/rms", headers: athlete,
      payload: { updates: [{ lift: "arranque", kg: 90 }], reason: "manual" } })).statusCode).toBe(401);

    const c2 = await app.inject({ method: "POST", url: "/auth/signup",
      payload: { email: `c2-rm-${Date.now()}@x.dev`, password: "another-pass-1", role: "coach", name: "C2" } });
    expect((await app.inject({ method: "GET", url: "/athletes/mv/rm-history", headers: sess(c2) })).statusCode).toBe(403);
    expect((await app.inject({ method: "PUT", url: "/athletes/mv/rms", headers: sess(c2),
      payload: { updates: [{ lift: "arranque", kg: 90 }], reason: "manual" } })).statusCode).toBe(403);
  });

  it("input inválido 400; sin plan 404", async () => {
    const coach = await login("coach@holyoly.dev");
    expect((await app.inject({ method: "PUT", url: "/athletes/mv/rms", headers: coach,
      payload: { updates: [], reason: "manual" } })).statusCode).toBe(400);
    expect((await app.inject({ method: "PUT", url: "/athletes/mv/rms", headers: coach,
      payload: { updates: [{ lift: "arranque", kg: 90 }], reason: "assign" } })).statusCode).toBe(400);

    // tl (Tomás) puede traer plan seed → se lo quitamos directo en DB para el caso sin-plan.
    await prisma.plan.deleteMany({ where: { athleteId: "tl" } });
    expect((await app.inject({ method: "PUT", url: "/athletes/tl/rms", headers: coach,
      payload: { updates: [{ lift: "arranque", kg: 90 }], reason: "manual" } })).statusCode).toBe(404);
    // Reads sin plan: honestos, listas vacías.
    expect((await app.inject({ method: "GET", url: "/athletes/tl/pr-candidates", headers: coach })).json()).toEqual([]);
  });
});
```

- [ ] **Step 4.2: Run verify — must FAIL (RED)** (endpoints no existen → 404 ≠ 200/401/403):

Run: `pnpm --filter @holy-oly/api verify`
Expected: la suite existente PASA; `rm.int.test.ts` FALLA (404s). Si `tl` no tiene Vínculo con el coach seed y el guard devuelve 403 antes del 404 → ajustar ese caso a otro atleta del roster del coach sin plan, o crear el plan-less via deleteMany como está y aceptar 403→ entonces usar un atleta vinculado (ver roster en `prisma/seed.ts`) — resolver en GREEN con el seed real a la vista.

- [ ] **Step 4.3: Repo — mapper compartido + funciones SP5** — `apps/api/src/repo.ts`:

(a) Ampliar imports de core (línea 2-8): agregar `RmLift, RmReason, RmUpdate, PrCandidate` al type-import y `prCandidates, RM_LIFTS` + `RM` al value/type import:

```ts
import type {
  Atleta, MacrocycleLevel, MonitorSeries, Medal, Competencia, Plan, CycleContext, SessionLog,
  DayLog, DayLogView, DayLogResult, MePlanView, DayLogInput,
  PrescribedExercise, PrescriptionRow, SessionView, MovementFlag, SessionActual, ExerciseActualInput,
  CycleShare, CycleState, WeekHeat, RM, RmLift, RmReason, RmUpdate, PrCandidate,
} from "@holy-oly/core";
import { RMSchema, buildMePlanView, computeStreak, MACROCYCLES, MACRO_RECIPES, instantiatePrescription, buildSessionViews, mergeActuals, summarizeSets, barKgForSexo, SetActualsSchema, planHeat, prCandidates, RM_LIFTS } from "@holy-oly/core";
```

(b) Extraer el mapper de actuals (hoy inline en `getPrescriptionWeek`, líneas ~226-235) a una función arriba de `getPrescriptionWeek`, y usarla en ambos lados:

```ts
interface SessionActualRow {
  week: number; sessionIdx: number; order: number; movementId: string; done: boolean;
  prescribedMovementId: string | null; actualKg: number | null; actualReps: number | null;
  note: string | null; doneAt: string | null; sets: unknown;
}
function toSessionActual(a: SessionActualRow): SessionActual {
  const parsedSets = a.sets != null ? SetActualsSchema.safeParse(a.sets) : null;
  return {
    week: a.week, sessionIdx: a.sessionIdx, order: a.order, movementId: a.movementId, done: a.done,
    prescribedMovementId: a.prescribedMovementId ?? undefined,
    actualKg: a.actualKg ?? undefined, actualReps: a.actualReps ?? undefined,
    note: a.note ?? undefined, doneAt: a.doneAt ?? undefined,
    sets: parsedSets && parsedSets.success ? parsedSets.data : undefined,
  };
}
```

En `getPrescriptionWeek`, reemplazar el `.map((a) => {...})` inline por `actualRows.map(toSessionActual)`.

(c) `savePlan` gana `today` y siembra los baselines en la MISMA transacción:

```ts
export async function savePlan(prisma: PrismaClient, athleteId: string, plan: Plan, today: string): Promise<void> {
  // rms is a plain {lift: number} object → JSON-safe; the double cast satisfies Prisma's Json input
  // type (RM has no string index signature to overlap InputJsonValue directly).
  const data = { macroId: plan.macroId, startWeek: plan.startWeek, startDate: plan.startDate ?? null, rms: plan.rms as unknown as Prisma.InputJsonValue };
  await prisma.$transaction(async (tx) => {
    await tx.plan.upsert({ where: { athleteId }, create: { athleteId, ...data }, update: data });
    await instantiateForPlan(tx, athleteId, plan);
    // SP5: cada asignación fija los 4 RMs → baseline del historial (vigencia honesta).
    const setAt = plan.startDate ?? today;
    await tx.rmUpdate.createMany({
      data: RM_LIFTS.map((lift) => ({ athleteId, lift, kg: plan.rms[lift], setAt, reason: "assign" })),
    });
  });
}
```

(d) Funciones nuevas (después de `getPlanHeat`):

```ts
// ── SP5: RMs a mitad de ciclo. updateRms NO re-instancia (las ediciones del coach sobreviven);
//    el kg se deriva en lectura (rms × pct) → la cascada es automática. ──

/** Merge transaccional de 1+ lifts en Plan.rms + append al historial. false si no hay plan. */
export async function updateRms(prisma: PrismaClient, athleteId: string, updates: { lift: RmLift; kg: number }[], reason: "manual" | "pr", today: string): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const p = await tx.plan.findUnique({ where: { athleteId } });
    if (!p) return false;
    const merged: RM = { ...RMSchema.parse(p.rms) };
    for (const u of updates) merged[u.lift] = u.kg;
    await tx.plan.update({ where: { athleteId }, data: { rms: merged as unknown as Prisma.InputJsonValue } });
    await tx.rmUpdate.createMany({ data: updates.map((u) => ({ athleteId, lift: u.lift, kg: u.kg, setAt: today, reason })) });
    return true;
  });
}

/** Sets hechos que superan el RM vigente (≤1 por lift). [] sin plan — honesto. */
export async function getPrCandidates(prisma: PrismaClient, athleteId: string): Promise<PrCandidate[]> {
  const plan = await getPlan(prisma, athleteId);
  if (!plan) return [];
  const rows = await prisma.sessionActual.findMany({ where: { athleteId } });
  return prCandidates(rows.map(toSessionActual), plan.rms);
}

/** Historial append-only, más nuevo primero (mismo día → createdAt desestabiliza el empate). */
export async function getRmHistory(prisma: PrismaClient, athleteId: string): Promise<RmUpdate[]> {
  const rows = await prisma.rmUpdate.findMany({ where: { athleteId }, orderBy: [{ setAt: "desc" }, { createdAt: "desc" }] });
  return rows.map((r) => ({ lift: r.lift as RmLift, kg: r.kg, setAt: r.setAt, reason: r.reason as RmReason }));
}
```

- [ ] **Step 4.4: Server — endpoints + todayISO** — `apps/api/src/server.ts`:

(a) Import: agregar `UpdateRmsInputSchema` al import de `@holy-oly/core` existente.

(b) Helper local (cerca del tope del builder, junto a los guards):

```ts
/** Server's calendar date (UTC) — mirrors me/routes.todayISO. */
const todayISO = (): string => new Date().toISOString().slice(0, 10);
```

(c) PUT /plan (línea ~231): `await repo.savePlan(prisma, req.params.id, parsed.data, todayISO());`

(d) Después del endpoint `/athletes/:id/heat` (línea ~278):

```ts
  // ── SP5: RMs a mitad de ciclo (coach-only; el atleta JAMÁS ve RMs — HR-1). ──
  app.put<{ Params: { id: string } }>("/athletes/:id/rms", async (req, reply) => {
    if (!(await guardAthleteWrite(req, reply, req.params.id))) return;
    const parsed = UpdateRmsInputSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid rms" });
    const ok = await repo.updateRms(prisma, req.params.id, parsed.data.updates, parsed.data.reason, todayISO());
    if (!ok) return reply.code(404).send({ error: "no plan" });
    await recordAudit(prisma, { action: "rms.write", actorUserId: req.userId, actorRole: req.role, targetAthleteId: req.params.id, ip: req.ip });
    return reply.code(200).send({ ok: true });
  });

  app.get<{ Params: { id: string } }>("/athletes/:id/pr-candidates", async (req, reply) => {
    if (!(await guardAthlete(req, reply, req.params.id))) return;
    return repo.getPrCandidates(prisma, req.params.id);
  });

  app.get<{ Params: { id: string } }>("/athletes/:id/rm-history", async (req, reply) => {
    if (!(await guardAthlete(req, reply, req.params.id))) return;
    return repo.getRmHistory(prisma, req.params.id);
  });
```

- [ ] **Step 4.5: Typecheck + unit + verify — must PASS (GREEN):**

Run: `pnpm --filter @holy-oly/api typecheck && pnpm --filter @holy-oly/api test`
Expected: PASS.
Run: `pnpm --filter @holy-oly/api verify`
Expected: PASS — int suite existente + `rm.int.test.ts` completos. Si el caso `tl` da 403 (sin Vínculo) en vez de 404: elegir en el seed real un atleta vinculado al coach y borrarle el plan con `prisma.plan.deleteMany` (mismo patrón), actualizar el test, re-verify.

- [ ] **Step 4.6: Commit**

```bash
git add apps/api/src/rm.int.test.ts apps/api/src/repo.ts apps/api/src/server.ts
git commit -m "feat(api): updateRms sin re-instanciar + pr-candidates + rm-history + baseline en savePlan (SP5)"
```

---

### Task 5: Web data — `Repository` interface + Http + Local (TDD)

**Files:**
- Modify: `packages/core/src/repository.ts`
- Modify: `apps/web/src/data/HttpRepository.ts`
- Modify: `apps/web/src/data/LocalRepository.ts`
- Modify: `apps/web/src/data/keys.ts`
- Create: `apps/web/src/data/LocalRepository.rm.test.ts`

- [ ] **Step 5.1: Write the failing test** — `apps/web/src/data/LocalRepository.rm.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import type { Plan, SessionActual } from "@holy-oly/core";
import { LocalRepository } from "./LocalRepository";
import { MemStorage } from "../test-utils/MemStorage";

const PLAN: Plan = {
  atletaId: "x1", macroId: "ruso-5d", startWeek: 1, startDate: "2026-04-01",
  rms: { arranque: 80, envion: 100, sentadilla: 140, frente: 110 }, comps: [],
};

function setup(actuals: SessionActual[] = []) {
  const store = new MemStorage();
  store.setItem("ho:actuals:x1", JSON.stringify(actuals));
  const repo = new LocalRepository(store);
  return { repo, store };
}

describe("LocalRepository — SP5 RMs", () => {
  it("savePlan siembra 4 baselines (reason assign, setAt = startDate)", async () => {
    const { repo } = setup();
    await repo.savePlan(PLAN);
    const hist = await repo.getRmHistory("x1");
    expect(hist).toHaveLength(4);
    expect(hist.every((h) => h.reason === "assign" && h.setAt === "2026-04-01")).toBe(true);
    expect(hist.find((h) => h.lift === "sentadilla")!.kg).toBe(140);
  });

  it("updateRms mergea el plan + appendea historial SIN re-instanciar la prescripción", async () => {
    const { repo } = setup();
    await repo.savePlan(PLAN);
    // edición del coach que updateRms NO debe pisar:
    await repo.setSession("x1", 1, 0, [{ movementId: "sentadilla", sets: 5, reps: 5, pct: 70 }]);

    await repo.updateRms("x1", [{ lift: "sentadilla", kg: 160 }], "manual");

    const plan = (await repo.getPlan("x1"))!;
    expect(plan.rms.sentadilla).toBe(160);
    expect(plan.rms.arranque).toBe(80);

    const week = await repo.getPrescriptionWeek("x1", 1);
    const s0 = week.find((s) => s.sessionIdx === 0)!;
    expect(s0.exercises).toHaveLength(1); // la edición sobrevivió
    expect(s0.exercises[0]!.targetKg).toBe(112); // 70% de 160 — cascada

    const hist = await repo.getRmHistory("x1");
    expect(hist[0]).toMatchObject({ lift: "sentadilla", kg: 160, reason: "manual" }); // desc
    expect(hist).toHaveLength(5);
  });

  it("getPrCandidates: estricto > RM, desde los actuals del storage; [] sin plan", async () => {
    const { repo } = setup([
      { week: 1, sessionIdx: 0, order: 0, movementId: "arranque", done: true, actualKg: 85 },
      { week: 1, sessionIdx: 0, order: 1, movementId: "envion", done: true, actualKg: 100 }, // == RM → no
    ]);
    expect(await repo.getPrCandidates("x1")).toEqual([]); // sin plan → honesto
    await repo.savePlan(PLAN);
    const cands = await repo.getPrCandidates("x1");
    expect(cands).toHaveLength(1);
    expect(cands[0]).toMatchObject({ lift: "arranque", kg: 85 });
  });

  it("updateRms sin plan → rechaza (error), no escribe nada", async () => {
    const { repo } = setup();
    await expect(repo.updateRms("x1", [{ lift: "arranque", kg: 90 }], "manual")).rejects.toThrow();
    expect(await repo.getRmHistory("x1")).toEqual([]);
  });
});
```

- [ ] **Step 5.2: Run — must FAIL:**

Run: `pnpm --filter @holy-oly/web test -- LocalRepository.rm`
Expected: FAIL — `updateRms`/`getRmHistory` no existen (TS/objeto). (Si `MemStorage` no expone `setItem`, mirá `apps/web/src/test-utils/MemStorage.ts` y usá su API real para sembrar la key `ho:actuals:x1`.)

- [ ] **Step 5.3: Interface** — `packages/core/src/repository.ts`:

(a) ampliar el type-import: `..., WeekHeat, PrCandidate, RmLift, RmUpdate`.
(b) agregar al final de la interface (después de `setSession`):

```ts
  /** Sube/edita 1+ RMs del plan a mitad de ciclo SIN re-instanciar (el kg derivado recae solo).
   *  `reason`: "manual" (edición del coach) | "pr" (confirmación de un PR detectado). */
  updateRms(id: string, updates: { lift: RmLift; kg: number }[], reason: "manual" | "pr"): Promise<void>;
  /** Sets hechos que SUPERAN el RM vigente (sugerencias de PR; ≤1 por lift). [] sin plan. */
  getPrCandidates(id: string): Promise<PrCandidate[]>;
  /** Historial append-only de RMs, más nuevo primero. [] sin historial (planes pre-SP5). */
  getRmHistory(id: string): Promise<RmUpdate[]>;
```

- [ ] **Step 5.4: HttpRepository** — `apps/web/src/data/HttpRepository.ts`:

(a) imports: agregar `PrCandidatesSchema, RmUpdatesSchema` (values) y `PrCandidate, RmLift, RmUpdate` (types).
(b) métodos al final de la clase:

```ts
  async updateRms(id: string, updates: { lift: RmLift; kg: number }[], reason: "manual" | "pr"): Promise<void> {
    return this.mutate(this.athletePath(id, "rms"), "PUT", { updates, reason });
  }
  async getPrCandidates(id: string): Promise<PrCandidate[]> {
    return this.get(this.athletePath(id, "pr-candidates"), PrCandidatesSchema);
  }
  async getRmHistory(id: string): Promise<RmUpdate[]> {
    return this.get(this.athletePath(id, "rm-history"), RmUpdatesSchema);
  }
```

- [ ] **Step 5.5: keys** — `apps/web/src/data/keys.ts`, después de `sessionActuals`:

```ts
  rmUpdates: (id: string) => `ho:rmupdates:${id}`,
```

- [ ] **Step 5.6: LocalRepository** — `apps/web/src/data/LocalRepository.ts`:

(a) imports: agregar types `PrCandidate, RmLift, RmUpdate` y values `RmUpdatesSchema, SessionActualsSchema, prCandidates, RM_LIFTS`.
(b) en `savePlan`, al final (después del set de prescription):

```ts
    // SP5: cada asignación fija los 4 RMs → baseline del historial (mirror del API).
    const today = new Date().toISOString().slice(0, 10);
    const setAt = plan.startDate ?? today;
    this.appendRmUpdates(plan.atletaId, RM_LIFTS.map((lift) => ({ lift, kg: plan.rms[lift], setAt, reason: "assign" as const })));
```

(c) métodos nuevos (después de `getPlanHeat`):

```ts
  // ── SP5: RMs a mitad de ciclo (mirror del API). updateRms NO re-instancia. ──
  private rmRows(id: string): RmUpdate[] {
    const r = RmUpdatesSchema.safeParse(this.s.getOptional<unknown>(KEYS.rmUpdates(id)));
    return r.success ? r.data : [];
  }
  private appendRmUpdates(id: string, rows: RmUpdate[]): void {
    this.s.set(KEYS.rmUpdates(id), [...this.rmRows(id), ...rows]);
  }
  async updateRms(id: string, updates: { lift: RmLift; kg: number }[], reason: "manual" | "pr"): Promise<void> {
    const plan = await this.getPlan(id);
    if (!plan) throw new Error("sin plan");
    const rms = { ...plan.rms };
    for (const u of updates) rms[u.lift] = u.kg;
    // Set directo del plan — NO savePlan (re-instanciaría y pisaría las ediciones del coach).
    this.s.set(KEYS.plan(id), { ...plan, rms });
    const today = new Date().toISOString().slice(0, 10);
    this.appendRmUpdates(id, updates.map((u) => ({ lift: u.lift, kg: u.kg, setAt: today, reason })));
  }
  async getPrCandidates(id: string): Promise<PrCandidate[]> {
    const plan = await this.getPlan(id);
    if (!plan) return [];
    const r = SessionActualsSchema.safeParse(this.s.getOptional<unknown>(KEYS.sessionActuals(id)));
    return prCandidates(r.success ? r.data : [], plan.rms);
  }
  async getRmHistory(id: string): Promise<RmUpdate[]> {
    return [...this.rmRows(id)].reverse(); // append-order → más nuevo primero
  }
```

- [ ] **Step 5.7: Run — must PASS** (+ typecheck de los 3 paquetes, porque la interface creció):

Run: `pnpm --filter @holy-oly/web test -- LocalRepository.rm && pnpm -r typecheck`
Expected: PASS. (Si typecheck acusa otro implementador de `Repository` — buscar con grep `implements Repository` — agregarle los 3 métodos con el mismo contrato.)

- [ ] **Step 5.8: Commit**

```bash
git add packages/core/src/repository.ts apps/web/src/data/HttpRepository.ts apps/web/src/data/LocalRepository.ts apps/web/src/data/keys.ts apps/web/src/data/LocalRepository.rm.test.ts
git commit -m "feat(web): Repository.updateRms/getPrCandidates/getRmHistory (Http + Local) (SP5)"
```

---

### Task 6: Web UI — `RmEditSheet` + `RmSection` (TDD)

**Files:**
- Create: `apps/web/src/screens/coach/rm/RmEditSheet.tsx`
- Create: `apps/web/src/screens/coach/rm/RmSection.tsx`
- Create: `apps/web/src/screens/coach/rm/RmSection.test.tsx`

Diseño (tokens `--wl-*`, reusa `BottomSheet`; SIN discos — panel de números del coach):
- Header: "RMs · base del plan" + botón "Editar".
- Grilla 2×2: por lift → label (Arranque/Envión/Sentadilla/Frente), `{kg} kg` grande, línea de vigencia: "fijado hace N sem" / "fijado esta semana" / "—" (sin dato). N ≥ 12 → color ámbar `#eab308` (hint sutil, sin umbral duro).
- "PRs por confirmar" (sólo si hay candidatos): card por candidato — "{movementName} · levantó {kg} kg · sem {week}" + botón "Confirmar → subir RM".
- Sheet: modo `manual` (4 inputs prefijados con los RMs) o modo `pr` (1 input prefijado con el kg del candidato + contexto + helper "El RM final lo ponés vos (si lo hizo por reps, el 1RM es más)."). Guardar deshabilitado si no hay cambios válidos; error de red → inline "No se pudo guardar. Reintentá." y el sheet queda abierto.

- [ ] **Step 6.1: Write the failing test** — `apps/web/src/screens/coach/rm/RmSection.test.tsx`:

```tsx
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import type { Plan, SessionActual } from "@holy-oly/core";
import { RepositoryProvider } from "../../../data/RepositoryProvider";
import { LocalRepository } from "../../../data/LocalRepository";
import { MemStorage } from "../../../test-utils/MemStorage";
import { RmSection } from "./RmSection";

const PLAN: Plan = {
  atletaId: "x1", macroId: "ruso-5d", startWeek: 1, startDate: "2026-04-01",
  rms: { arranque: 80, envion: 100, sentadilla: 140, frente: 110 }, comps: [],
};
const TODAY = "2026-06-10"; // 10 semanas después del startDate

async function setup(actuals: SessionActual[] = [], onRmsChange = () => {}) {
  const store = new MemStorage();
  store.setItem("ho:actuals:x1", JSON.stringify(actuals));
  const repo = new LocalRepository(store);
  await repo.savePlan(PLAN);
  render(
    <RepositoryProvider repo={repo}>
      <RmSection athleteId="x1" plan={(await repo.getPlan("x1"))!} today={TODAY} onRmsChange={onRmsChange} />
    </RepositoryProvider>,
  );
  return repo;
}

test("muestra los 4 RMs con su vigencia (fijado hace N sem)", async () => {
  await setup();
  await waitFor(() => expect(screen.getByText("Arranque")).toBeInTheDocument());
  expect(screen.getByText("Envión")).toBeInTheDocument();
  expect(screen.getByText("Sentadilla")).toBeInTheDocument();
  expect(screen.getByText("Frente")).toBeInTheDocument();
  expect(screen.getByText("80 kg")).toBeInTheDocument();
  expect(screen.getByText("140 kg")).toBeInTheDocument();
  expect(screen.getAllByText("fijado hace 10 sem")).toHaveLength(4);
});

test("PR por confirmar: card con movimiento + kg + semana; confirmar sube el RM con reason 'pr' y se auto-resuelve", async () => {
  let changed = 0;
  const repo = await setup(
    [{ week: 3, sessionIdx: 0, order: 0, movementId: "arranque.potencia", done: true, actualKg: 86 }],
    () => { changed++; },
  );
  await waitFor(() => expect(screen.getByText(/PRs por confirmar/i)).toBeInTheDocument());
  expect(screen.getByText(/levantó 86 kg · sem 3/)).toBeInTheDocument();

  fireEvent.click(screen.getByRole("button", { name: /confirmar/i }));
  const input = await screen.findByLabelText("Arranque");
  fireEvent.change(input, { target: { value: "88" } });
  fireEvent.click(screen.getByRole("button", { name: "Guardar" }));

  await waitFor(async () => expect((await repo.getPlan("x1"))!.rms.arranque).toBe(88));
  expect((await repo.getRmHistory("x1"))[0]).toMatchObject({ lift: "arranque", kg: 88, reason: "pr" });
  expect(changed).toBe(1);
  await waitFor(() => expect(screen.queryByText(/PRs por confirmar/i)).not.toBeInTheDocument()); // 86 > 88 es falso → resuelto
});

test("editar manda SOLO los lifts cambiados con reason 'manual'", async () => {
  const repo = await setup();
  await waitFor(() => expect(screen.getByText("Arranque")).toBeInTheDocument());
  fireEvent.click(screen.getByRole("button", { name: "Editar" }));
  const envion = await screen.findByLabelText("Envión");
  fireEvent.change(envion, { target: { value: "105" } });
  fireEvent.click(screen.getByRole("button", { name: "Guardar" }));

  await waitFor(async () => expect((await repo.getPlan("x1"))!.rms.envion).toBe(105));
  const hist = await repo.getRmHistory("x1");
  expect(hist[0]).toMatchObject({ lift: "envion", kg: 105, reason: "manual" });
  expect(hist).toHaveLength(5); // 4 baselines + 1 (sólo el cambiado)
});

test("guardar sin cambios queda deshabilitado; error del repo → mensaje y el sheet sigue abierto", async () => {
  class FailingRepo extends LocalRepository {
    async updateRms(): Promise<void> { throw new Error("boom"); }
  }
  const store = new MemStorage();
  const repo = new FailingRepo(store);
  await repo.savePlan(PLAN);
  render(
    <RepositoryProvider repo={repo}>
      <RmSection athleteId="x1" plan={PLAN} today={TODAY} onRmsChange={() => {}} />
    </RepositoryProvider>,
  );
  fireEvent.click(await screen.findByRole("button", { name: "Editar" }));
  const save = await screen.findByRole("button", { name: "Guardar" });
  expect(save).toBeDisabled(); // sin cambios
  fireEvent.change(screen.getByLabelText("Arranque"), { target: { value: "90" } });
  expect(save).not.toBeDisabled();
  fireEvent.click(save);
  expect(await screen.findByText(/no se pudo guardar/i)).toBeInTheDocument();
  expect(screen.getByLabelText("Arranque")).toBeInTheDocument(); // sheet abierto
});
```

- [ ] **Step 6.2: Run — must FAIL** (componentes no existen):

Run: `pnpm --filter @holy-oly/web test -- RmSection`
Expected: FAIL — cannot resolve `./RmSection`.

- [ ] **Step 6.3: Implement `RmEditSheet`** — `apps/web/src/screens/coach/rm/RmEditSheet.tsx`:

```tsx
import { useEffect, useState } from "react";
import type { PrCandidate, RM, RmLift } from "@holy-oly/core";
import { RM_LIFTS } from "@holy-oly/core";
import { BottomSheet } from "../../../ui/BottomSheet";

export const RM_LABELS: Record<RmLift, string> = {
  arranque: "Arranque", envion: "Envión", sentadilla: "Sentadilla", frente: "Frente",
};

/** "manual": editar 1+ de los 4 · "pr": confirmar un candidato (un solo lift, kg precargado). */
export type RmSheetMode = { kind: "manual" } | { kind: "pr"; candidate: PrCandidate };

type Draft = Record<RmLift, string>;
const toDraft = (rms: RM): Draft => ({
  arranque: String(rms.arranque), envion: String(rms.envion), sentadilla: String(rms.sentadilla), frente: String(rms.frente),
});

const validKg = (s: string): boolean => { const n = Number(s); return Number.isFinite(n) && n > 0 && n <= 500; };

const inputStyle = {
  width: "100%", boxSizing: "border-box" as const, padding: "10px 12px", borderRadius: 10,
  border: "1px solid color-mix(in srgb,var(--wl-text) 18%,transparent)", background: "var(--wl-bg)",
  color: "var(--wl-text)", fontFamily: "var(--mono)", fontSize: 15,
};

export function RmEditSheet({ open, mode, rms, onClose, onSave }: {
  open: boolean;
  mode: RmSheetMode;
  rms: RM;
  onClose: () => void;
  onSave: (updates: { lift: RmLift; kg: number }[], reason: "manual" | "pr") => Promise<void>;
}) {
  const [draft, setDraft] = useState<Draft>(() => toDraft(rms));
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState(false);

  // Re-armar el borrador al abrir (manual: los 4 RMs vigentes; pr: el kg del candidato).
  useEffect(() => {
    if (!open) return;
    const base = toDraft(rms);
    if (mode.kind === "pr") base[mode.candidate.lift] = String(mode.candidate.kg);
    setDraft(base);
    setSaveError(false);
  }, [open, mode, rms]);

  if (!open) return null;
  const lifts: readonly RmLift[] = mode.kind === "pr" ? [mode.candidate.lift] : RM_LIFTS;
  const updates = lifts
    .filter((l) => validKg(draft[l]) && Number(draft[l]) !== rms[l])
    .map((l) => ({ lift: l, kg: Number(draft[l]) }));
  const prSameKg = mode.kind === "pr" && lifts.every((l) => validKg(draft[l])); // confirmar sin tocar = válido
  const canSave = !saving && lifts.every((l) => validKg(draft[l])) && (updates.length > 0 || prSameKg);

  async function submit(): Promise<void> {
    const reason = mode.kind === "pr" ? "pr" as const : "manual" as const;
    // En modo pr, aunque el coach no toque el valor, se manda igual (reconfirma honesto).
    const toSend = updates.length > 0 ? updates : lifts.map((l) => ({ lift: l, kg: Number(draft[l]) }));
    setSaving(true); setSaveError(false);
    try {
      await onSave(toSend, reason);
      onClose();
    } catch {
      setSaveError(true);
    } finally {
      setSaving(false);
    }
  }

  return (
    <BottomSheet open onClose={onClose} ariaLabel={mode.kind === "pr" ? "Confirmar PR" : "Editar RMs"}>
      <div style={{ fontFamily: "var(--wl-display)", fontWeight: 800, fontSize: 16 }}>
        {mode.kind === "pr" ? "Confirmar PR → subir RM" : "Editar RMs"}
      </div>
      {mode.kind === "pr" && (
        <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--wl-muted)", marginTop: 6 }}>
          {mode.candidate.movementName} · levantó {mode.candidate.kg} kg · sem {mode.candidate.week}
          <br />El RM final lo ponés vos (si lo hizo por reps, el 1RM es más).
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: mode.kind === "pr" ? "1fr" : "1fr 1fr", gap: 10, marginTop: 12 }}>
        {lifts.map((l) => (
          <label key={l} style={{ display: "grid", gap: 4, fontFamily: "var(--mono)", fontSize: 10, color: "var(--wl-muted)" }}>
            {RM_LABELS[l]}
            <input
              inputMode="decimal"
              aria-invalid={!validKg(draft[l])}
              value={draft[l]}
              onChange={(e) => setDraft((d) => ({ ...d, [l]: e.target.value }))}
              style={inputStyle}
            />
          </label>
        ))}
      </div>
      {saveError && (
        <div role="alert" style={{ fontFamily: "var(--mono)", fontSize: 10.5, color: "#ff3b46", marginTop: 10 }}>
          No se pudo guardar. Reintentá.
        </div>
      )}
      <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
        <button type="button" onClick={onClose}
          style={{ flex: 1, minHeight: 44, borderRadius: 10, border: "1px solid color-mix(in srgb,var(--wl-text) 15%,transparent)", background: "transparent", color: "var(--wl-text)", fontFamily: "var(--wl-display)", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>
          Cancelar
        </button>
        <button type="button" disabled={!canSave} onClick={() => void submit()}
          style={{ flex: 1, minHeight: 44, borderRadius: 10, border: 0, background: canSave ? "var(--wl-accent)" : "color-mix(in srgb,var(--wl-text) 12%,transparent)", color: canSave ? "var(--wl-bg)" : "var(--wl-muted)", fontFamily: "var(--wl-display)", fontWeight: 700, fontSize: 13, cursor: canSave ? "pointer" : "default" }}>
          {saving ? "Guardando…" : "Guardar"}
        </button>
      </div>
    </BottomSheet>
  );
}
```

- [ ] **Step 6.4: Implement `RmSection`** — `apps/web/src/screens/coach/rm/RmSection.tsx`:

```tsx
import { useCallback, useEffect, useState } from "react";
import type { Plan, PrCandidate, RmLift, RmUpdate } from "@holy-oly/core";
import { RM_LIFTS, rmVigencia } from "@holy-oly/core";
import { useRepository } from "../../../data/RepositoryProvider";
import { RM_LABELS, RmEditSheet, type RmSheetMode } from "./RmEditSheet";

const STALE_WEEKS = 12; // hint sutil, sin umbral duro (spec §8: mostrar la edad siempre)

/** Sección "RMs" del drill-down del coach (SP5). Carga sus propios datos (candidatos + historial)
 *  con error honesto + retry, como PlanMapSection. El atleta JAMÁS ve esta superficie. */
export function RmSection({ athleteId, plan, today, onRmsChange }: {
  athleteId: string;
  plan: Plan;
  today: string;
  onRmsChange: () => void;
}) {
  const repo = useRepository();
  const [candidates, setCandidates] = useState<PrCandidate[]>([]);
  const [history, setHistory] = useState<RmUpdate[]>([]);
  const [error, setError] = useState(false);
  const [sheet, setSheet] = useState<RmSheetMode | null>(null);

  const load = useCallback(async () => {
    try {
      const [c, h] = await Promise.all([repo.getPrCandidates(athleteId), repo.getRmHistory(athleteId)]);
      setCandidates(c); setHistory(h); setError(false);
    } catch {
      setError(true);
    }
  }, [repo, athleteId]);
  useEffect(() => { void load(); }, [load]);

  const vig = rmVigencia(history, plan.startDate, today);
  const vigLabel = (l: RmLift): string => {
    const w = vig[l].weeksAgo;
    if (w == null) return "—";
    return w === 0 ? "fijado esta semana" : `fijado hace ${w} sem`;
  };

  async function save(updates: { lift: RmLift; kg: number }[], reason: "manual" | "pr"): Promise<void> {
    await repo.updateRms(athleteId, updates, reason);
    await load();
    onRmsChange();
  }

  return (
    <section style={{ marginTop: 16 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
        <div style={{ fontFamily: "var(--wl-display)", fontWeight: 700, fontSize: 13.5 }}>RMs · base del plan</div>
        <button type="button" onClick={() => setSheet({ kind: "manual" })}
          style={{ padding: "6px 14px", borderRadius: 10, border: "1px solid color-mix(in srgb,var(--wl-accent) 50%,transparent)", background: "color-mix(in srgb,var(--wl-accent) 12%,transparent)", color: "var(--wl-text)", fontFamily: "var(--wl-display)", fontWeight: 700, fontSize: 12, cursor: "pointer" }}>
          Editar
        </button>
      </div>
      {error && (
        <div role="alert" style={{ fontFamily: "var(--mono)", fontSize: 10.5, color: "#ff3b46", marginTop: 8 }}>
          No se pudieron cargar los PRs/historial.{" "}
          <button type="button" onClick={() => void load()}
            style={{ border: 0, background: "transparent", color: "var(--wl-accent)", fontFamily: "var(--mono)", fontSize: 10.5, cursor: "pointer", textDecoration: "underline", padding: 0 }}>
            Reintentar
          </button>
        </div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 }}>
        {RM_LIFTS.map((l) => {
          const stale = (vig[l].weeksAgo ?? 0) >= STALE_WEEKS;
          return (
            <div key={l} style={{ padding: "10px 12px", borderRadius: 12, background: "var(--wl-surface)", border: "1px solid color-mix(in srgb,var(--wl-text) 8%,transparent)" }}>
              <div style={{ fontFamily: "var(--mono)", fontSize: 9, letterSpacing: ".1em", textTransform: "uppercase", color: "var(--wl-muted)" }}>{RM_LABELS[l]}</div>
              <div style={{ fontFamily: "var(--wl-display)", fontWeight: 800, fontSize: 18, marginTop: 2 }}>{plan.rms[l]} kg</div>
              <div style={{ fontFamily: "var(--mono)", fontSize: 9.5, marginTop: 2, color: stale ? "#eab308" : "var(--wl-muted)" }}>{vigLabel(l)}</div>
            </div>
          );
        })}
      </div>
      {candidates.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <div style={{ fontFamily: "var(--wl-display)", fontWeight: 700, fontSize: 12.5 }}>PRs por confirmar</div>
          {candidates.map((c) => (
            <div key={c.lift} style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 8, padding: "10px 12px", borderRadius: 12, background: "color-mix(in srgb,var(--wl-accent) 8%,var(--wl-surface))", border: "1px solid color-mix(in srgb,var(--wl-accent) 35%,transparent)" }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontFamily: "var(--wl-display)", fontWeight: 700, fontSize: 12.5 }}>{c.movementName}</div>
                <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--wl-muted)", marginTop: 2 }}>
                  levantó {c.kg} kg · sem {c.week}
                </div>
              </div>
              <button type="button" aria-label={`Confirmar PR de ${RM_LABELS[c.lift]}`} onClick={() => setSheet({ kind: "pr", candidate: c })}
                style={{ flex: "0 0 auto", minHeight: 40, padding: "0 12px", borderRadius: 10, border: 0, background: "var(--wl-accent)", color: "var(--wl-bg)", fontFamily: "var(--wl-display)", fontWeight: 700, fontSize: 11.5, cursor: "pointer" }}>
                Confirmar → subir RM
              </button>
            </div>
          ))}
        </div>
      )}
      {sheet != null && (
        <RmEditSheet open mode={sheet} rms={plan.rms} onClose={() => setSheet(null)} onSave={save} />
      )}
    </section>
  );
}
```

- [ ] **Step 6.5: Run — must PASS:**

Run: `pnpm --filter @holy-oly/web test -- RmSection`
Expected: PASS (4 tests). Ajustes probables si fallan: el `findByLabelText("Arranque")` exige que el `<label>` envuelva el input (lo hace); el botón "Confirmar → subir RM" se matchea con `/confirmar/i`.

- [ ] **Step 6.6: Commit**

```bash
git add apps/web/src/screens/coach/rm/
git commit -m "feat(web): RmSection + RmEditSheet (RMs, vigencia, PRs por confirmar) (SP5)"
```

---

### Task 7: Web — wiring en `Drilldown` (refresh honesto del kg derivado)

**Files:**
- Modify: `apps/web/src/screens/coach/Drilldown.tsx`

- [ ] **Step 7.1: Wire** — en `Drilldown.tsx`:

(a) import: `import { RmSection } from "./rm/RmSection";`

(b) estado + callback (junto a los otros useState/useCallback, líneas ~44-52):

```tsx
  // SP5: tras subir un RM, remontar las secciones que cachean kg derivado (mapa + sesiones).
  const [rmsStamp, setRmsStamp] = useState(0);
  const onRmsChange = useCallback(async () => {
    setPlan(await repo.getPlan(id));
    setRmsStamp((s) => s + 1);
  }, [repo, id]);
```

(c) keys de remount: en `<PlanCalendar` agregar `key={`cal-${rmsStamp}`}` y en `<SessionsSection` agregar `key={`ses-${rmsStamp}`}`.

(d) la sección, entre `<SessionsSection …/>` y el título "Palmarés · competencias":

```tsx
      {plan && <RmSection athleteId={id} plan={plan} today={today} onRmsChange={() => void onRmsChange()} />}
```

- [ ] **Step 7.2: Suite web completa + typecheck — must PASS:**

Run: `pnpm --filter @holy-oly/web test && pnpm --filter @holy-oly/web typecheck`
Expected: PASS (283 + ~9 nuevos). Si algún test existente del Drilldown se rompe porque ahora aparece "RMs · base del plan": revisarlo y ajustar la aserción rota (la sección sólo aparece con plan — los seeds de SEED_PLAN_INPUTS).

- [ ] **Step 7.3: Commit**

```bash
git add apps/web/src/screens/coach/Drilldown.tsx
git commit -m "feat(web): seccion RMs en el drill-down del coach (SP5)"
```

---

### Task 8: Verificación integral + reviews

- [ ] **Step 8.1: Todo el monorepo:**

Run: `pnpm -r typecheck && pnpm --filter @holy-oly/core test && pnpm --filter @holy-oly/web test && pnpm --filter @holy-oly/api test && pnpm --filter @holy-oly/api verify && pnpm -r lint`
Expected: todo verde; eslint 0 errors (1 warning preexistente en `email/index.ts` OK).

- [ ] **Step 8.2: Review de dominio (El Carnicero).** El agente registrado no está disponible en esta sesión → dispatch de un subagente general-purpose cuyo prompt incluye VERBATIM `.claude/agents/el-carnicero.md` + `docs/domain/HOLY-OLY-DOMAIN.md` + el diff (`git diff a673dca..HEAD`). Focos que el spec le encarga (§7-8): la regla de PR (estricto >, variantes flaggeadas, coach juzga), que el RM NUNCA se auto-calcule por reps, que subir el RM no infle nada artificialmente (charts/adherencia no leen RmUpdate), que el atleta no vea RMs (endpoints coach-only), sin-dato honesto.

- [ ] **Step 8.3: Review React** (react-reviewer sobre los .tsx nuevos/modificados). Aplicar CRITICAL/HIGH; MEDIUM si es barato.

- [ ] **Step 8.4: Fixes de los reviews + re-run del Step 8.1 + commit** (mensaje según lo encontrado, p.ej. `fix(sp5): hallazgos del review de dominio/react`).

- [ ] **Step 8.5: Smoke en vivo (opcional pero recomendado):** build api+web del worktree, levantar `local-app.mjs` aislado (PORT 8766, HOLYOLY_DEMO_DIR `C:\HolyOlyDemo-sp5-smoke`, PG 5441) y verificar por DOM: sección RMs visible en el drill-down de Kevin, editar un RM → el kg de la sesión cambia, cero RPE. Apagar y borrar el dir de smoke al terminar.

---

### Task 9: Ship — FF a main (local), handoff y memoria

- [ ] **Step 9.1: FF a main con el stash-dance** (el checkout principal tiene el WIP booking SIN commitear — NO tocarlo, NO commitearlo):

```powershell
# En C:\Holy Oly 0017 (checkout principal):
git -C "C:\Holy Oly 0017" stash push -u -m "WIP booking ajeno (preservar)"
git -C "C:\Holy Oly 0017" merge --ff-only claude/nifty-lumiere-6f1195
git -C "C:\Holy Oly 0017" stash pop
git -C "C:\Holy Oly 0017" status --short   # el WIP booking debe seguir ahí, sin conflictos
```

Expected: FF limpio; `stash pop` sin conflictos (los archivos del WIP no se tocan en SP5 — schema.prisma SÍ se toca: el WIP modifica schema.prisma para booking → el stash pop puede conflictuar ahí. Si conflictúa: resolver preservando AMBOS cambios — el modelo RmUpdate commiteado + las líneas booking del WIP — y NO commitear).
**NO pushear.**

- [ ] **Step 9.2: Rebuild de la instancia de pruebas del owner** (`:8765`, estado `C:\HolyOlyDemo-heat`, PG 5440) — buildear desde ESTE worktree, nunca desde main:

```powershell
$wt = "C:\Holy Oly 0017\.claude\worktrees\nifty-lumiere-6f1195"
pnpm --dir $wt --filter @holy-oly/api build
$env:VITE_API_ENABLED = "true"; pnpm --dir $wt --filter @holy-oly/web build
Remove-Item "$wt\apps\api\dist\public" -Recurse -Force -ErrorAction SilentlyContinue
Copy-Item "$wt\apps\web\dist" "$wt\apps\api\dist\public" -Recurse
# matar el node que tenga :8765 y relanzar:
$env:HOLYOLY_DEMO_DIR = "C:\HolyOlyDemo-heat"; $env:HOLYOLY_PG_PORT = "5440"; $env:PORT = "8765"
node "$wt\apps\api\scripts\local-app.mjs"
```

(migración 16 se aplica al boot; la 15 del booking no existe en este árbol — ordering aceptado por el owner en el handoff).

- [ ] **Step 9.3: Handoff + memoria:** actualizar/crear `docs/superpowers/HANDOFF-2026-06-10-sp5.md` (estado git, qué se construyó, próximos pasos: motor Prilepin leyendo la reconciliación primero) + actualizar `MEMORY.md` y la memoria de athlete-app (SP5 SHIPPED, migración 16 usada → el booking pasa a la 17 o renumera). Commitear los docs (`docs(handoff): …`) y FF de nuevo si hace falta.

---

## Self-review (hecho al escribir el plan)

- **Spec coverage:** §3.1 modelo+migración (T3) · §3.2 core (T1/T2) · §3.3 API (T4) · §3.4 Repository (T5) · §3.5 UI (T6/T7) · §4 edge cases (tests T2/T4/T5/T6: sin plan 404/[], variante, transacción revierte→UI error, authz, no-op same-kg vía modo pr) · §5 tests (todos) · §6 no-negociables (asserts anti-RPE no aplican — no se agrega superficie de atleta; authz tests cubren HR-1) · §7 decomposición seguida · §8 defaults aplicados (flaggear todo, edad sin umbral + hint 12 sem).
- **Tipos consistentes:** `RmLift`/`RmReason`/`RmUpdate`/`PrCandidate`/`RmVigencia` (T1) usados idénticos en T2/T4/T5/T6; `RM_LIFTS` exportado de `logic/rm.ts`; `RM_LABELS` exportado de `RmEditSheet.tsx`.
- **Sin placeholders:** todo código completo; los dos puntos honestamente incompletos son contingencias documentadas con su resolución (Step 4.5 atleta sin plan según seed real; Step 9.1 conflicto posible del stash en schema.prisma).
