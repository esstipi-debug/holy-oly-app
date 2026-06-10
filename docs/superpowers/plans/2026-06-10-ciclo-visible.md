# Ciclo visible (Capas 1–2) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** La atleta registra su ciclo (opt-in), lo ve proyectado sobre su mapa del plan (período / pre-período, paleta neutra), y el coach recibe el contrato redactado con `inLutealNow` REAL — sin que fase/fechas crucen jamás al coach.

**Architecture:** Core puro (`logic/cycle.ts`: aritmética modular con horizonte honesto + redacción) → API (`/me/cycle` cifrado at-rest, migración 17; `getCycle` coach computa lúteo sólo bajo `share:"full"`) → web (meClient + sección Cuenta + overlay en `PlanHeatMap` vía prop opcional + chip del Drilldown). Espejo Local completo para el demo.

**Tech Stack:** TypeScript estricto, Zod, Prisma (PG embebido en tests int), React + vitest/testing-library (fireEvent — idiom del repo), cifrado AES-256-GCM existente (`crypto-at-rest.ts`).

**Spec:** `docs/superpowers/specs/2026-06-10-ciclo-visible-design.md` (defaults §8: PERIOD=5, PRE=5, LUTEAL=14, HORIZON=3 ciclos, len 21..45).

**Reglas duras:** fase/día/fechas JAMÁS al coach (sólo booleano lúteo bajo full) · paleta neutra (derivada de `--wl-text`) · nunca semáforo · audit sin payload · proyección SOLO con `state:"regular"` · sin `startDate` no hay overlay.

---

### Task C1: Core — tipos + `logic/cycle.ts` + schemas (TDD)

**Files:**
- Modify: `packages/core/src/types/index.ts` (junto a CycleShare/CycleState/CycleContext, ~línea 67)
- Create: `packages/core/src/logic/cycle.ts`
- Create: `packages/core/src/logic/cycle.test.ts`
- Modify: `packages/core/src/schemas.ts` (junto a CycleContextSchema, ~línea 98)
- Modify: `packages/core/src/index.ts` (export del logic nuevo)

- [ ] **Step 1.1: Tipos.** En `types/index.ts`, después de `CycleContext`:

```ts
/** La verdad de la atleta (sólo viaja por /me — el coach JAMÁS recibe este shape). */
export interface CycleData { share: CycleShare; state: CycleState; lastPeriodStart?: string; cycleLengthDays?: number; }
/** Marca proyectada de un día en el calendario de la atleta. */
export type CycleMark = "periodo" | "preperiodo";
```

- [ ] **Step 1.2: Test RED** — `packages/core/src/logic/cycle.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { cycleDayOf, cycleMarkFor, lutealNow, redactCycle } from "./cycle";

// start 2026-06-01, len 28 → período 1–5 jun · pre-período 24–28 jun · lútea desde día 14 (15 jun).
const START = "2026-06-01";
const LEN = 28;

describe("cycleDayOf", () => {
  it("día 0 el día de inicio; modular en ciclos siguientes", () => {
    expect(cycleDayOf(START, LEN, "2026-06-01")).toBe(0);
    expect(cycleDayOf(START, LEN, "2026-06-29")).toBe(0); // ciclo 2
    expect(cycleDayOf(START, LEN, "2026-07-01")).toBe(2);
  });
  it("antes del inicio → null (no proyectar al pasado)", () => {
    expect(cycleDayOf(START, LEN, "2026-05-31")).toBeNull();
  });
  it("horizonte: dentro de 3 ciclos sí, después null (proyección honesta)", () => {
    expect(cycleDayOf(START, LEN, "2026-08-23")).toBe(27); // día 83 = 3·28−1
    expect(cycleDayOf(START, LEN, "2026-08-24")).toBeNull(); // día 84 = 3·28
  });
  it("largo fuera de 21..45 → null", () => {
    expect(cycleDayOf(START, 20, "2026-06-01")).toBeNull();
    expect(cycleDayOf(START, 46, "2026-06-01")).toBeNull();
  });
});

describe("cycleMarkFor", () => {
  it("período = días 0..4; el 5 ya no", () => {
    expect(cycleMarkFor(START, LEN, "2026-06-05")).toBe("periodo"); // día 4
    expect(cycleMarkFor(START, LEN, "2026-06-06")).toBeNull();      // día 5
  });
  it("pre-período = últimos 5 días (23..27 con len 28)", () => {
    expect(cycleMarkFor(START, LEN, "2026-06-23")).toBeNull();        // día 22
    expect(cycleMarkFor(START, LEN, "2026-06-24")).toBe("preperiodo"); // día 23
    expect(cycleMarkFor(START, LEN, "2026-06-28")).toBe("preperiodo"); // día 27
  });
});

describe("lutealNow", () => {
  it("lútea = últimos 14 días (límite exacto)", () => {
    expect(lutealNow(START, LEN, "2026-06-14")).toBe(false); // día 13
    expect(lutealNow(START, LEN, "2026-06-15")).toBe(true);  // día 14 = 28−14
  });
  it("sin proyección válida → null", () => {
    expect(lutealNow(START, LEN, "2026-05-01")).toBeNull();
  });
});

describe("redactCycle", () => {
  it("none → undefined; min → lúteo null; full → lúteo pasado tal cual", () => {
    expect(redactCycle("none", "regular", true)).toBeUndefined();
    expect(redactCycle("min", "regular", true)).toEqual({ share: "min", inLutealNow: null, health: "ok", reliable: true });
    expect(redactCycle("full", "regular", true)).toEqual({ share: "full", inLutealNow: true, health: "ok", reliable: true });
    expect(redactCycle("full", "regular", null)).toEqual({ share: "full", inLutealNow: null, health: "ok", reliable: true });
  });
  it("amenorrea → referral sobrio; unreliable → reliable false", () => {
    expect(redactCycle("min", "amenorrhea", null)).toEqual({ share: "min", inLutealNow: null, health: "referral", reliable: false });
    expect(redactCycle("full", "unreliable", null)).toEqual({ share: "full", inLutealNow: null, health: "ok", reliable: false });
  });
});
```

- [ ] **Step 1.2b:** Run `pnpm --filter @holy-oly/core test -- cycle` → FAIL (módulo no existe).

- [ ] **Step 1.3: Implementación** — `packages/core/src/logic/cycle.ts`:

```ts
/**
 * Ciclo menstrual — proyección PURA sobre fechas (slice ciclo-visible, Capas 1–2).
 * Defaults v1 (criterio nombrado, NO ciencia inventada — ajustables acá y en ningún otro lado):
 * período = primeros 5 días · pre-período = últimos 5 · lútea = últimos 14 (aprox estándar) ·
 * horizonte = 3 ciclos desde lastPeriodStart (más allá la proyección decae a null — honesto).
 * La ELEGIBILIDAD (state === "regular") la gatea el caller; estas funciones sólo hacen fechas.
 */
import type { CycleContext, CycleMark, CycleShare, CycleState } from "../types";

export const CYCLE_PERIOD_DAYS = 5;
export const CYCLE_PRE_DAYS = 5;
export const CYCLE_LUTEAL_DAYS = 14;
export const CYCLE_HORIZON_CYCLES = 3;
export const CYCLE_LEN_MIN = 21;
export const CYCLE_LEN_MAX = 45;

const DAY = 86_400_000;
const ms = (iso: string): number => new Date(`${iso}T00:00:00Z`).getTime();

/** Día 0-based dentro del ciclo para `date`; null si date < inicio, fuera de horizonte, o len inválido. */
export function cycleDayOf(lastPeriodStart: string, lengthDays: number, date: string): number | null {
  if (!Number.isInteger(lengthDays) || lengthDays < CYCLE_LEN_MIN || lengthDays > CYCLE_LEN_MAX) return null;
  const diff = Math.floor((ms(date) - ms(lastPeriodStart)) / DAY);
  if (diff < 0 || diff >= lengthDays * CYCLE_HORIZON_CYCLES) return null;
  return diff % lengthDays;
}

/** Marca proyectada del día: período (0..4) · pre-período (len−5..len−1) · null. */
export function cycleMarkFor(lastPeriodStart: string, lengthDays: number, date: string): CycleMark | null {
  const d = cycleDayOf(lastPeriodStart, lengthDays, date);
  if (d == null) return null;
  if (d < CYCLE_PERIOD_DAYS) return "periodo";
  if (d >= lengthDays - CYCLE_PRE_DAYS) return "preperiodo";
  return null;
}

/** ¿`today` cae en la ventana lútea (últimos 14 días)? null sin proyección válida. */
export function lutealNow(lastPeriodStart: string, lengthDays: number, today: string): boolean | null {
  const d = cycleDayOf(lastPeriodStart, lengthDays, today);
  if (d == null) return null;
  return d >= lengthDays - CYCLE_LUTEAL_DAYS;
}

/**
 * Redacción coach-facing (movida a core para que API y LocalRepository no driften):
 * el coach SOLO recibe este shape — jamás fase/día/fechas. `lutealNow` lo computa el caller
 * (sólo bajo share "full"); acá se anula para "min" por contrato.
 */
export function redactCycle(share: CycleShare, state: CycleState, lutealNow: boolean | null): CycleContext | undefined {
  if (share === "none") return undefined;
  const reliable = state === "regular";
  const health: CycleContext["health"] = state === "amenorrhea" ? "referral" : "ok";
  return { share, inLutealNow: share === "full" ? lutealNow : null, health, reliable };
}
```

- [ ] **Step 1.4: Schemas.** En `schemas.ts` después de `CycleContextSchema`:

```ts
/** La verdad de la atleta (lectura /me) = el input del PUT (mismo shape, acotado). */
export const CycleDataSchema = z.object({
  share: CycleShareSchema,
  state: CycleStateSchema,
  lastPeriodStart: IsoDateSchema.optional(),
  cycleLengthDays: z.number().int().min(21).max(45).optional(),
});
export const PutMeCycleInputSchema = CycleDataSchema;
```

- [ ] **Step 1.5: Export.** `packages/core/src/index.ts`: agregar `export * from "./logic/cycle";` junto a los otros logic.

- [ ] **Step 1.6:** Run `pnpm --filter @holy-oly/core test` → PASS · `pnpm --filter @holy-oly/core typecheck` → limpio.

- [ ] **Step 1.7: Commit** `feat(core): proyeccion del ciclo (fase/ventanas/luteo) + redaccion movida a core (ciclo-visible)`

---

### Task C2: API — migración 17 + `/me/cycle` + redacción real + export

**Files:**
- Modify: `apps/api/prisma/schema.prisma` (model CycleConsent, ~línea 324)
- Create: `apps/api/prisma/migrations/17_cycle_fields/migration.sql` (vía script)
- Modify: `apps/api/src/repo.ts` (getCycle ~89; exportAthleteData ~342; + getMyCycle/putMyCycle nuevos)
- Delete/absorb: `apps/api/src/cycle.ts` (redactCycle vive en core ahora; actualizar imports y mover su test si existe)
- Modify: `apps/api/src/me/routes.ts` (+2 endpoints)
- Create: `apps/api/src/cycle-data.int.test.ts`

- [ ] **Step 2.1: Schema.** En `model CycleConsent` agregar:

```prisma
  /// Slice ciclo-visible: registro de la atleta — cifrados at-rest igual que share/state (TEXT ciphertext).
  lastPeriodStart String?
  cycleLengthDays String?
```

- [ ] **Step 2.2: Migración.** Run: `pnpm --filter @holy-oly/api exec tsx scripts/make-migration.ts 17 cycle_fields`
Expected: `prisma/migrations/17_cycle_fields/migration.sql` con los 2 `ALTER TABLE "CycleConsent" ADD COLUMN`. Luego `pnpm --filter @holy-oly/api exec prisma generate`.
(Recordatorio del árbol: la 15 es del booking WIP sin commitear → al commitearlo renumera a **18**.)

- [ ] **Step 2.3: Test int RED** — `apps/api/src/cycle-data.int.test.ts`:

```ts
import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { FastifyInstance } from "fastify";
import { buildServer } from "./server";
import { prisma } from "./db/client";

type Res = { cookies: Array<{ name: string; value: string }>; statusCode: number };
const sess = (r: Res) => ({ cookie: `session=${r.cookies.find((c) => c.name === "session")!.value}` });
const iso = (d: Date) => d.toISOString().slice(0, 10);
const daysAgo = (n: number) => iso(new Date(Date.now() - n * 86_400_000));

describe("API integration — ciclo (slice ciclo-visible)", () => {
  let app: FastifyInstance;
  beforeAll(async () => { app = buildServer(); await app.ready(); });
  afterAll(async () => { await app.close(); await prisma.$disconnect(); });

  const login = async (email: string) => {
    const r = await app.inject({ method: "POST", url: "/auth/login", payload: { email, password: "holyoly-demo" } });
    expect(r.statusCode).toBe(200);
    return sess(r as unknown as Res);
  };

  it("PUT/GET /me/cycle roundtrip + cifrado at-rest en la fila cruda", async () => {
    const mara = await login("mara@holyoly.dev");
    // día 20 del ciclo (len 28) → lútea (20 ≥ 14)
    const body = { share: "full", state: "regular", lastPeriodStart: daysAgo(20), cycleLengthDays: 28 };
    expect((await app.inject({ method: "PUT", url: "/me/cycle", headers: mara, payload: body })).statusCode).toBe(200);

    const got = (await app.inject({ method: "GET", url: "/me/cycle", headers: mara })).json() as typeof body;
    expect(got).toEqual(body);

    // La fila cruda NO contiene la fecha en claro (cifrado at-rest, prefijo enc:v1:).
    const row = await prisma.cycleConsent.findUnique({ where: { athleteId: "mv" } });
    expect(row!.lastPeriodStart!.startsWith("enc:v1:")).toBe(true);
    expect(row!.lastPeriodStart).not.toContain(body.lastPeriodStart);
  });

  it("coach: payload EXACTO {share,inLutealNow,health,reliable} con luteo REAL — jamás fecha/fase", async () => {
    const coach = await login("coach@holyoly.dev");
    const res = await app.inject({ method: "GET", url: "/athletes/mv/cycle", headers: coach });
    expect(res.statusCode).toBe(200);
    const ctx = res.json() as Record<string, unknown>;
    expect(Object.keys(ctx).sort()).toEqual(["health", "inLutealNow", "reliable", "share"]);
    expect(ctx.inLutealNow).toBe(true); // día 20 ≥ 28−14 — computado, ya no placeholder
    expect(JSON.stringify(ctx)).not.toMatch(/periodo|lastPeriod|cycleLength|\d{4}-\d{2}-\d{2}/);
  });

  it("share min → luteo null; volver a none → coach sin contexto", async () => {
    const mara = await login("mara@holyoly.dev");
    const coach = await login("coach@holyoly.dev");
    await app.inject({ method: "PUT", url: "/me/cycle", headers: mara,
      payload: { share: "min", state: "regular", lastPeriodStart: daysAgo(20), cycleLengthDays: 28 } });
    expect(((await app.inject({ method: "GET", url: "/athletes/mv/cycle", headers: coach })).json() as { inLutealNow: unknown }).inLutealNow).toBeNull();
    await app.inject({ method: "PUT", url: "/me/cycle", headers: mara, payload: { share: "none", state: "regular" } });
    expect((await app.inject({ method: "GET", url: "/athletes/mv/cycle", headers: coach })).statusCode).toBe(404);
  });

  it("validación y authz: len fuera de rango 400; sin sesión 401; export incluye el registro crudo", async () => {
    const mara = await login("mara@holyoly.dev");
    expect((await app.inject({ method: "PUT", url: "/me/cycle", headers: mara,
      payload: { share: "full", state: "regular", cycleLengthDays: 50 } })).statusCode).toBe(400);
    expect((await app.inject({ method: "GET", url: "/me/cycle" })).statusCode).toBe(401);
    expect((await app.inject({ method: "PUT", url: "/me/cycle", payload: { share: "none", state: "regular" } })).statusCode).toBe(401);

    await app.inject({ method: "PUT", url: "/me/cycle", headers: mara,
      payload: { share: "full", state: "regular", lastPeriodStart: daysAgo(20), cycleLengthDays: 28 } });
    const exp = (await app.inject({ method: "GET", url: "/me/export", headers: mara })).json() as { cycle: { lastPeriodStart: string | null } };
    expect(exp.cycle.lastPeriodStart).toBe(daysAgo(20)); // descifrado: su dato crudo es suyo (D3)
  });
});
```

- [ ] **Step 2.4: Repo.** En `repo.ts` — importar `CycleData, CycleMark` types + `lutealNow, redactCycle` de core; `encryptAtRest` además de `decryptAtRest`. Reemplazar `getCycle` y agregar:

```ts
/** Coach-facing cycle: SOLO la proyección redactada — la fila cruda jamás sale del server. */
export async function getCycle(prisma: PrismaClient, athleteId: string, today: string): Promise<CycleContext | undefined> {
  const c = await prisma.cycleConsent.findUnique({ where: { athleteId } });
  if (!c) return undefined;
  const share = decryptAtRest(c.share) as CycleShare;
  const state = decryptAtRest(c.state) as CycleState;
  // Lúteo REAL sólo bajo "full" + estado regular + datos; si no, null honesto (jamás inventar).
  let luteal: boolean | null = null;
  if (share === "full" && state === "regular" && c.lastPeriodStart != null && c.cycleLengthDays != null) {
    const len = Number(decryptAtRest(c.cycleLengthDays));
    luteal = Number.isFinite(len) ? lutealNow(decryptAtRest(c.lastPeriodStart), len, today) : null;
  }
  return redactCycle(share, state, luteal);
}

/** La verdad de la atleta (sólo /me). Sin fila → default honesto "no optó". */
export async function getMyCycle(prisma: PrismaClient, athleteId: string): Promise<CycleData> {
  const c = await prisma.cycleConsent.findUnique({ where: { athleteId } });
  if (!c) return { share: "none", state: "regular" };
  const len = c.cycleLengthDays == null ? NaN : Number(decryptAtRest(c.cycleLengthDays));
  return {
    share: decryptAtRest(c.share) as CycleShare,
    state: decryptAtRest(c.state) as CycleState,
    ...(c.lastPeriodStart == null ? {} : { lastPeriodStart: decryptAtRest(c.lastPeriodStart) }),
    ...(Number.isFinite(len) ? { cycleLengthDays: len } : {}),
  };
}

/** Upsert del registro de la atleta — los 4 campos cifrados at-rest (D1). */
export async function putMyCycle(prisma: PrismaClient, athleteId: string, input: CycleData): Promise<void> {
  const data = {
    share: encryptAtRest(input.share),
    state: encryptAtRest(input.state),
    lastPeriodStart: input.lastPeriodStart == null ? null : encryptAtRest(input.lastPeriodStart),
    cycleLengthDays: input.cycleLengthDays == null ? null : encryptAtRest(String(input.cycleLengthDays)),
  };
  await prisma.cycleConsent.upsert({ where: { athleteId }, create: { athleteId, ...data }, update: data });
}
```

En `exportAthleteData`, el bloque `cycleRaw` descifra también los campos nuevos:

```ts
  const cycleRaw = cycle
    ? {
        ...cycle,
        share: decryptAtRest(cycle.share),
        state: decryptAtRest(cycle.state),
        lastPeriodStart: cycle.lastPeriodStart == null ? null : decryptAtRest(cycle.lastPeriodStart),
        cycleLengthDays: cycle.cycleLengthDays == null ? null : decryptAtRest(cycle.cycleLengthDays),
      }
    : null;
```

Borrar `apps/api/src/cycle.ts` (la redacción vive en core); actualizar el import en `repo.ts` y mover/ajustar el test unit de redacción si existe (la cobertura quedó en `core/logic/cycle.test.ts`). Buscar el caller de `getCycle` en `server.ts` y pasarle `today` (mismo `todayISO()` que usan las rutas).

- [ ] **Step 2.5: Rutas.** En `me/routes.ts` (importar `PutMeCycleInputSchema` de core y `recordAudit` ya está):

```ts
  app.get("/me/cycle", async (req, reply) => {
    const athleteId = requireAthlete(req, reply);
    if (!athleteId) return;
    return repo.getMyCycle(prisma, athleteId);
  });

  app.put("/me/cycle", async (req, reply) => {
    const athleteId = requireAthlete(req, reply);
    if (!athleteId) return;
    const parsed = PutMeCycleInputSchema.safeParse(req.body);
    if (!parsed.success) return reply.code(400).send({ error: "invalid cycle" });
    await repo.putMyCycle(prisma, athleteId, parsed.data);
    // Audit SIN payload — el módulo audit prohíbe datos de salud en el log (sólo ids+acción+ip).
    await recordAudit(prisma, { action: "cycle.write", targetAthleteId: athleteId, ip: req.ip });
    return reply.code(200).send({ ok: true });
  });
```

(Ajustar los campos de `recordAudit` al `AuditInput` real — copiar el patrón del write auditado existente, p.ej. el de `rms.write` en `server.ts`.)

- [ ] **Step 2.6:** Run `pnpm --filter @holy-oly/api verify` → PASS (incluye el int nuevo + los previos; el de redacción del coach del archivo viejo, si referenciaba el placeholder, se actualiza a luteo real). `pnpm --filter @holy-oly/api typecheck` limpio.

- [ ] **Step 2.7: Commit** `feat(api): /me/cycle cifrado + inLutealNow real + export (migracion 17_cycle_fields)`

---

### Task C3: Web data — meClient + Local + seeds

**Files:**
- Modify: `apps/web/src/data/keys.ts` · `apps/web/src/data/meClient.ts` · `apps/web/src/data/httpMeClient.ts` · `apps/web/src/data/LocalMeClient.ts` · `apps/web/src/data/LocalRepository.ts` (getCycleContext) · `apps/web/src/data/seeds.ts`
- Test: `apps/web/src/data/LocalMeClient.cycle.test.ts` (create) + ajuste de `LocalRepository.test.ts` si asserta el luteo

- [ ] **Step 3.1: KEYS** — agregar:

```ts
  // Slice ciclo-visible: registro de la atleta (los MISMOS keys que lee el coach-side local).
  cycleStart: (id: string) => `ho:cycleStart:${id}`,
  cycleLen: (id: string) => `ho:cycleLen:${id}`,
```

- [ ] **Step 3.2: meClient.** Interface `MeClient` += `getMeCycle(): Promise<CycleData>; putMeCycle(input: CycleData): Promise<void>;` + las funciones módulo + el objeto singleton (mismo patrón que `getMeHeat`).

- [ ] **Step 3.3: httpMeClient:**

```ts
/** El registro propio del ciclo (la verdad de la atleta; el coach jamás recibe este shape). */
export async function getMeCycle(): Promise<CycleData> {
  const res = await fetch(`${BASE}/me/cycle`, { credentials: "include" });
  if (!res.ok) return fail(res);
  return CycleDataSchema.parse(await res.json());
}
export async function putMeCycle(input: CycleData): Promise<void> {
  const res = await fetch(`${BASE}/me/cycle`, {
    method: "PUT", credentials: "include",
    headers: { "content-type": "application/json" }, body: JSON.stringify(input),
  });
  if (!res.ok) return fail(res);
}
```

- [ ] **Step 3.4: LocalMeClient** (espejo, id-scoped): `getMeCycle` lee share/state/start/len de KEYS (defaults `{share:"none", state:"regular"}`); `putMeCycle` escribe los 4 (borra start/len si vienen undefined). Validar lecturas con `CycleDataSchema.safeParse` armado a mano (share/state via sus schemas; start string; len Number).

- [ ] **Step 3.5: LocalRepository.getCycleContext** — usar core: leer share/state + start/len de KEYS; `luteal = share==="full" && state==="regular" && start && len ? lutealNow(start, len, todayISO()) : null;` y devolver `redactCycle(share, state, luteal)` (borrar la redacción inline duplicada). `todayISO()` = `new Date().toISOString().slice(0,10)` local al archivo (ya hay usos análogos).

- [ ] **Step 3.6: Seeds web** — `SEED_CYCLE` cambia de tipo a `Record<string, { share: CycleShare; state: CycleState; lastPeriodStart?: string; cycleLengthDays?: number }>` y Mara gana datos relativos a hoy (helper local `daysAgo`):

```ts
const daysAgo = (n: number): string => new Date(Date.now() - n * 86_400_000).toISOString().slice(0, 10);
export const SEED_CYCLE = {
  mv: { share: "full", state: "regular", lastPeriodStart: daysAgo(20), cycleLengthDays: 28 },
} as const satisfies Record<string, { share: CycleShare; state: CycleState; lastPeriodStart?: string; cycleLengthDays?: number }>;
```

y el loop de seed del `LocalRepository` escribe también `KEYS.cycleStart/cycleLen` cuando existen. Seed api (`prisma/seed.ts`): en la fila de cycle de `mv`, agregar los 2 campos con `encryptAtRest` (sólo afecta DBs frescas).

- [ ] **Step 3.7: Test** — `LocalMeClient.cycle.test.ts`: roundtrip put/get; default sin datos; y que `LocalRepository.getCycleContext("mv")` (seed) dé `inLutealNow: true` (día 20 de 28). Run suite web → PASS.

- [ ] **Step 3.8: Commit** `feat(web): meClient.getMeCycle/putMeCycle + Local espejo + luteo real en getCycleContext (ciclo-visible)`

---

### Task C4: Web atleta — sección «Ciclo» en Cuenta

**Files:**
- Create: `apps/web/src/screens/atleta/CicloSection.tsx`
- Modify: `apps/web/src/screens/atleta/CuentaMin.tsx` (montar la sección; leer su estructura primero y seguir su estilo de cards/labels)
- Test: `apps/web/src/screens/atleta/__tests__/cicloSection.test.tsx`

- [ ] **Step 4.1: Componente.** `CicloSection({ client }: { client: MeClient })` — carga `getMeCycle` al montar (guard de unmount + loading `role="status"` + error con Reintentar, patrón `RmSection`); formulario:
  - **Compartir** (radio/segmented 3): «No compartir» («el coach no ve nada»), «Mínimo» («sabe que registrás; sin detalle»), «Contexto» («además ve si estás en ventana lútea HOY — nunca fecha, fase ni síntomas»). Copy de privacidad SIEMPRE visible bajo la opción elegida.
  - **Mi ciclo** (select): «Regular» / «Irregular» / «Sin período (amenorrea)». Amenorrea → línea sobria: «Sin período hace meses: conviene conversarlo con un profesional de salud. Esto no es un logro deportivo.» Irregular → nota: «Con ciclo irregular no proyectamos ventanas (sería precisión falsa) — el registro igual sirve de contexto.»
  - **Inicio del último período** (`<input type="date">`) + **Duración típica (días)** (`inputMode="numeric"`, 21..45, `aria-invalid` fuera de rango).
  - **Guardar** → `putMeCycle` (deshabilitado si inválido; error visible; éxito = «Guardado ✓» breve). Todo `--wl-*`, paleta neutra (cero colores de estado).

- [ ] **Step 4.2: Montaje.** En `CuentaMin`, sección nueva «Ciclo» después del skin picker (o donde su estructura de secciones indique), `<CicloSection client={meClient} />`.

- [ ] **Step 4.3: Tests** (LocalMeClient + MemStorage): renderiza los 3 niveles con su copy de privacidad; guardar share full + fecha + 28 → `getMeCycle` refleja; len 50 → botón deshabilitado; amenorrea → texto de derivación presente; irregular → nota de no-proyección.

- [ ] **Step 4.4:** Suite web PASS → **Commit** `feat(web): seccion Ciclo en Cuenta - opt-in por eleccion + registro (ciclo-visible)`

---

### Task C5: Web atleta — overlay en el mapa + contexto del día + colisión

**Files:**
- Modify: `apps/web/src/ui/charts/PlanHeatMap.tsx` (prop `cycleMarks` + dot + aria; `HeatLegend` prop `showCycle`)
- Modify: `apps/web/src/ui/charts/PlanDayDetail.tsx` (prop `contextLine?: string` — leer el archivo y agregar la línea muted al final del cuerpo)
- Modify: `apps/web/src/screens/atleta/PlanMapSection.tsx` (carga cycle + marks + colisión + contextLine)
- Test: `apps/web/src/ui/charts/PlanHeatMap.test.tsx` (extender) + `apps/web/src/screens/atleta/__tests__/planMapSection.cycle.test.tsx` (create)

- [ ] **Step 5.1: PlanHeatMap.** Props += `cycleMarks?: ReadonlyMap<string, CycleMark>` (key `"week-day"`). En la celda: `const cmark = cycleMarks?.get(\`${w.week}-${day}\`);` — el `<button>` gana `position: "relative"`; dentro, después del cuadrado:

```tsx
{cmark != null && (
  <span aria-hidden style={{
    position: "absolute", left: "50%", transform: "translateX(-50%)", bottom: 1,
    width: 5, height: 5, borderRadius: "50%", boxSizing: "border-box",
    background: cmark === "periodo" ? "color-mix(in srgb, var(--wl-text) 65%, transparent)" : "transparent",
    border: cmark === "preperiodo" ? "1.5px solid color-mix(in srgb, var(--wl-text) 65%, transparent)" : "none",
  }} />
)}
```

y el `label` suma `· período (proy.)` / `· pre-período (proy.)`. `HeatLegend` gana `showCycle?: boolean` → swatches dot sólido + dot hueco con esas dos etiquetas. (Paleta NEUTRA derivada de `--wl-text` — regla del rulebook: jamás la de estado.)

- [ ] **Step 5.2: PlanDayDetail.** Prop `contextLine?: string` → al final: `<div style={{ marginTop: 6, fontFamily: "var(--mono)", fontSize: 9.5, color: "var(--wl-muted)" }}>{contextLine}</div>` (sólo si presente).

- [ ] **Step 5.3: PlanMapSection.** Estado `cycle: CycleData | null` cargado junto al heat (`client.getMeCycle()`, error → null silencioso: el mapa sigue sin overlay — el registro tiene su propio error en Cuenta). Derivar:

```ts
const cycleEligible = cycle != null && cycle.state === "regular"
  && cycle.lastPeriodStart != null && cycle.cycleLengthDays != null && plan.startDate != null;
const cycleMarks = useMemo(() => {
  if (!cycleEligible || heat == null) return undefined;
  const m = new Map<string, CycleMark>();
  for (const w of heat) for (let d = 0; d < 7; d++) {
    const date = new Date(ms(dateOfWeek(plan.startDate!, w.week)) + d * DAY).toISOString().slice(0, 10);
    const mark = cycleMarkFor(cycle!.lastPeriodStart!, cycle!.cycleLengthDays!, date);
    if (mark) m.set(`${w.week}-${d}`, mark);
  }
  return m.size > 0 ? m : undefined;
}, [cycleEligible, heat, cycle, plan.startDate]);
```

(`dateOfWeek` de core + `ms`/`DAY` locales como en `planDates.ts`.) Pasar `cycleMarks` y `showCycle={cycleMarks != null}` al mapa/leyenda. `contextLine` del día seleccionado con el mismo `cycleMarkFor`: período → «Período (proyección según tu registro) — contexto, no regla.» · pre → «Pre-período (proyección según tu registro) — contexto, no regla.». **Colisión** (línea muted bajo el mapa, sólo si existe):

```ts
const collision = useMemo(() => {
  if (!cycleMarks || heat == null) return null;
  let bw = 0, bv = -1;
  for (const w of heat) { const v = w.days.reduce((a, d) => a + (d?.lifts ?? 0), 0); if (v > bv) { bv = v; bw = w.week; } }
  if (bv <= 0) return null;
  for (let d = 0; d < 7; d++) { const k = cycleMarks.get(`${bw}-${d}`); if (k) return { week: bw, kind: k }; }
  return null;
}, [cycleMarks, heat]);
```

Render: «Tu semana más pesada (S{week}) cae en tu ventana {de período|pre-período} (proyección).»

- [ ] **Step 5.4: Tests.** PlanHeatMap: con `cycleMarks` el aria-label de la celda incluye «período (proy.)»; sin prop, nada. planMapSection.cycle: con seed de Mara (regular+datos+startDate) aparecen celdas marcadas + leyenda; con state irregular NO hay marcas; día marcado seleccionado → contextLine visible. **No-leak coach:** en `drilldown.test.tsx` assert `queryByText(/per[íi]odo|proyecci/i)` → null (el coach jamás ve las ventanas).

- [ ] **Step 5.5:** Suite web PASS → **Commit** `feat(web): overlay del ciclo en el mapa del plan + contexto del dia + colision (atleta-only)`

---

### Task C6: Web coach — chip redactado en Drilldown

**Files:**
- Modify: `apps/web/src/screens/coach/Drilldown.tsx` (Promise.all + línea)
- Test: `apps/web/src/screens/coach/__tests__/drilldown.test.tsx` (extender)

- [ ] **Step 6.1:** `Promise.all` inicial += `repo.getCycleContext(id)` → estado `cycleCtx: CycleContext | undefined`. Después del grid de charts:

```tsx
{cycleCtx && (
  <div style={{ marginTop: 10, fontFamily: "var(--mono)", fontSize: 10, color: "var(--wl-muted)" }}>
    Ciclo · {cycleCtx.share === "full"
      ? `compartido — contexto lúteo hoy: ${cycleCtx.inLutealNow == null ? "—" : cycleCtx.inLutealNow ? "sí" : "no"}`
      : "compartido (mínimo)"}
    {cycleCtx.health === "referral" ? " · derivación sugerida" : ""}
    {!cycleCtx.reliable && cycleCtx.health !== "referral" ? " · registro irregular" : ""}
  </div>
)}
```

(Muted neutro — NUNCA la paleta del semáforo; el semáforo no se toca.)

- [ ] **Step 6.2: Tests.** Drilldown con seed mv (share full, luteo computable) → texto «Ciclo · compartido — contexto lúteo hoy:»; share none (otro atleta) → sin línea; + el no-leak del Step 5.4.

- [ ] **Step 6.3:** Suite web PASS → **Commit** `feat(web): chip redactado del ciclo en el drill-down del coach (ciclo-visible)`

---

### Task C7: Verificación integral + reviews

- [ ] **Step 7.1:** `pnpm -r typecheck && pnpm --filter @holy-oly/core test && pnpm --filter @holy-oly/web test && pnpm --filter @holy-oly/api test && pnpm --filter @holy-oly/api verify && pnpm lint` — todo verde (lint: sólo el warning preexistente de `email/index.ts`).
- [ ] **Step 7.2: El Carnicero** (general-purpose con su persona verbatim + rulebook + `git diff <base>..HEAD`). Focos: privacidad del ciclo (redacción server-side, payload exacto, no-leak en superficies del coach), opt-in por elección, paleta neutra, NUNCA semáforo, amenorrea sobria, proyección honesta (horizonte/elegibilidad), sin-dato → null.
- [ ] **Step 7.3: react-reviewer** sobre los .tsx nuevos/modificados (CicloSection, PlanMapSection, PlanHeatMap, Drilldown).
- [ ] **Step 7.4:** Aplicar CRITICAL/HIGH (+MEDIUM baratos), re-run 7.1, commit `fix(ciclo): hallazgos de los reviews`.
- [ ] **Step 7.5: Smoke vivo opcional** (instancia aislada :8766/PG 5441/dir propio): registrar ciclo como atleta → overlay en su mapa; coach → chip; DOM del coach sin «período/proyección». Apagar; el dir queda (el guard no deja borrarlo — anotar).

### Task C8: Ship

- [ ] **Step 8.1:** FF a main con el stash-dance del booking (conflicto posible SOLO en `schema.prisma` → preservar AMBOS, NO commitear el WIP). **NO pushear.**
- [ ] **Step 8.2:** Rebuild + relanzar `:8765` (build api+web del worktree, copiar dist, matar node viejo, relanzar con `HOLYOLY_DEMO_DIR=C:\HolyOlyDemo-heat`, PG 5440, `HOLYOLY_NO_BROWSER=1`) — migración 17 aplica al boot.
- [ ] **Step 8.3:** Handoff `docs/superpowers/HANDOFF-2026-06-10-ciclo.md` + memoria (MEMORY.md línea de sesión + ciclo-menstrual-module.md actualizado: Capas 1–2 SHIPPED, mig 17, booking→18) + commit docs + FF de nuevo.

---

## Self-review (hecho al escribir el plan)

- **Spec coverage:** §3.1→C2 · §3.2→C1 · §3.3→C2 · §3.4→C3 · §3.5→C4/C5 · §3.6→C6 · §4 privacidad→tests C2/C5/C6 + El Carnicero · §5 bordes→tests C1/C3/C5 · §6→todos · §8 defaults→constantes C1.
- **Consistencia de tipos:** `CycleData`/`CycleMark` (C1) usados idénticos en C2/C3/C5; `redactCycle(share, state, lutealNow)` única firma (core), API y Local la consumen; key del Map = `"week-day"` en PlanHeatMap y PlanMapSection.
- **Sin placeholders:** los dos puntos delegados a lectura-en-sitio (estructura exacta de CuentaMin/PlanDayDetail/LocalMeClient y el shape de `AuditInput`) están marcados con la instrucción de copiar el patrón existente nombrado — no son TBD de diseño.
