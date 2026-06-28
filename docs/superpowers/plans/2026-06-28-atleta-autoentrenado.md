# Atleta autoentrenado (self-coach) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline) o superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Un atleta sin coach crea su propio macrociclo (escuela + fecha + 4 RMs) reusando el motor; el plan se enciende solo en Hoy/entreno/recorrido.

**Architecture:** Reuso total del motor y la persistencia (`buildAdaptivePlan`/`instantiatePrescription`/`savePlan`/`setComps`/`instantiateForPlan`). Net-new: 1 schema (core), 1 endpoint `POST /me/plan` (api), 1 método `createMyPlan` en las 3 impls del cliente (web), 1 pantalla "Crear mi ciclo" (web) desde el empty state de Hoy. Cero tablas nuevas.

**Tech Stack:** TS, Zod, Fastify, Prisma, React 18 + Vite, Vitest.

## Global Constraints

- Principal del atleta = `req.athleteId` (cookie de sesión), NUNCA del body/path.
- `/me/*` no pasa por `requireCoachWrite` → self-coach es gratis (deliberado).
- Orden CRÍTICO: `repo.setComps()` ANTES de `repo.savePlan()` (si no, `instantiateForPlan` lee comps viejas).
- RM input-only: el form capta RMs pero NUNCA los devuelve como lectura ("RM nunca crudo").
- Sin RPE en ninguna superficie del atleta. Discos solo vía `Disc.tsx`.
- Ancla obligatoria: fecha de competencia O `startDate` (si no, Hoy no calcula la semana).
- Plan único por atleta (`athleteId @unique`): self-assign ↔ coach-assign se pisan (aviso en UI).
- No hay macros female-only; el sexo solo define la barra 15/20 (ya lo aplica el motor).

---

### Task 1: Core — `SelfPlanInputSchema`

**Files:**
- Modify: `packages/core/src/schemas.ts` (tras `PlanSchema`, ~línea 90)
- Test: `packages/core/src/schemas.selfplan.test.ts` (crear)

**Interfaces:**
- Produces: `SelfPlanInputSchema` (Zod) + `type SelfPlanInput = { macroId: string; rms: RM; startDate?: string; comp?: { name: string; date: string } }`.

- [ ] **Step 1: Test que falla** — `packages/core/src/schemas.selfplan.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { SelfPlanInputSchema } from "./schemas";

const RMS = { arranque: 90, envion: 110, sentadilla: 150, frente: 125 };

describe("SelfPlanInputSchema", () => {
  it("acepta con competencia", () => {
    expect(SelfPlanInputSchema.safeParse({ macroId: "coreano-5d", rms: RMS, comp: { name: "Nacional", date: "2026-10-01" } }).success).toBe(true);
  });
  it("acepta con startDate (sin compe)", () => {
    expect(SelfPlanInputSchema.safeParse({ macroId: "coreano-5d", rms: RMS, startDate: "2026-07-01" }).success).toBe(true);
  });
  it("rechaza sin ancla (ni compe ni startDate)", () => {
    expect(SelfPlanInputSchema.safeParse({ macroId: "coreano-5d", rms: RMS }).success).toBe(false);
  });
  it("rechaza RM fuera de rango", () => {
    expect(SelfPlanInputSchema.safeParse({ macroId: "x", rms: { ...RMS, arranque: 0 }, startDate: "2026-07-01" }).success).toBe(false);
    expect(SelfPlanInputSchema.safeParse({ macroId: "x", rms: { ...RMS, sentadilla: 501 }, startDate: "2026-07-01" }).success).toBe(false);
  });
});
```

- [ ] **Step 2: Correr y ver fallar** — `pnpm --filter @holy-oly/core test schemas.selfplan` → FAIL (SelfPlanInputSchema undefined).

- [ ] **Step 3: Implementar** en `schemas.ts` (después de `PlanSchema`):

```ts
/** Self-coach: el atleta crea su propio plan. SIN atletaId (el server usa req.athleteId). Una
 *  competencia opcional. Ancla obligatoria: fecha de compe O startDate (si no, Hoy no calcula la
 *  semana). startWeek lo fija el server en 1. */
export const SelfPlanInputSchema = z
  .object({
    macroId: z.string().min(1).max(60),
    rms: RMSchema,
    startDate: IsoDateSchema.optional(),
    comp: z.object({ name: z.string().min(1).max(120), date: IsoDateSchema }).optional(),
  })
  .refine((v) => v.startDate != null || v.comp != null, { message: "ancla requerida: compe o startDate" });
export type SelfPlanInput = z.infer<typeof SelfPlanInputSchema>;
```

- [ ] **Step 4: Correr y ver pasar** — mismo comando → PASS.
- [ ] **Step 5: Commit** — `git add packages/core/src/schemas.ts packages/core/src/schemas.selfplan.test.ts && git commit -m "feat(core): SelfPlanInputSchema (atleta autoentrenado)"`

---

### Task 2: API — `POST /me/plan`

**Files:**
- Modify: `apps/api/src/me/routes.ts` (imports + nueva ruta)
- Test: `apps/api/src/me-plan.int.test.ts` (crear, espejo de `reperiodize.int.test.ts`)

**Interfaces:**
- Consumes: `SelfPlanInputSchema`, `MACROCYCLES`, `availableWeeksToComp`, `mondayOf` (core); `repo.setComps`, `repo.savePlan` (api).
- Produces: `POST /me/plan` → `200 {ok:true}` | `400` (invalid/unknown macro/compe pasada) | `401` (sin sesión) | `429` (rate-limit).

- [ ] **Step 1: Test de integración que falla** — `apps/api/src/me-plan.int.test.ts` (seguir el setup de `reperiodize.int.test.ts`: crear athlete, simular sesión de atleta). Casos:
  - atleta crea con compe → `Plan` existe, `prescribedExercise` > 0, `rmUpdate` baseline = 4 (reason `assign`).
  - sin sesión → 401.
  - macro inexistente → 400.
  - compe con fecha pasada → 400.

- [ ] **Step 2: Ver fallar** — `pnpm --filter @holy-oly/api test me-plan` → FAIL (404 ruta inexistente).

- [ ] **Step 3: Implementar** — en `apps/api/src/me/routes.ts`:
  - Imports (añadir): `SelfPlanInputSchema, MACROCYCLES, availableWeeksToComp, mondayOf` desde `@holy-oly/core`.
  - Throttle in-memory (arriba del `meRoutes`): `const lastSelfPlan = new Map<string, number>();` con ventana 5s.
  - Ruta (tras `/me/daylog`):

```ts
app.post("/me/plan", async (req, reply) => {
  const athleteId = requireAthlete(req, reply);
  if (!athleteId) return;
  const last = lastSelfPlan.get(athleteId);
  const nowMs = Date.now();
  if (last && nowMs - last < 5000) return reply.code(429).send({ error: "demasiado rápido" });
  const parsed = SelfPlanInputSchema.safeParse(req.body);
  if (!parsed.success) return reply.code(400).send({ error: "invalid plan" });
  const { macroId, rms, comp } = parsed.data;
  if (!MACROCYCLES.some((m) => m.id === macroId)) return reply.code(400).send({ error: "unknown macro" });
  const today = todayISO();
  if (comp && comp.date <= today) return reply.code(400).send({ error: "fecha pasada" });
  // Con compe: arranca el lunes y la escuela reescala para picar en la fecha (espejo AssignSheet
  // "competencia"). Sin compe: startDate ancla (espejo "inicio").
  const startMonday = mondayOf(today);
  const startDate = comp ? startMonday : parsed.data.startDate!;
  const comps = comp ? [{ name: comp.name, week: availableWeeksToComp(startMonday, comp.date), date: comp.date }] : [];
  await repo.setComps(prisma, athleteId, comps, today);           // ANTES de savePlan
  await repo.savePlan(prisma, athleteId, { atletaId: athleteId, macroId, startWeek: 1, startDate, rms, comps: [] }, today);
  lastSelfPlan.set(athleteId, nowMs);
  await recordAudit(prisma, { action: "plan.self_assign", actorUserId: req.userId, actorRole: req.role, targetAthleteId: athleteId, ip: req.ip });
  return reply.code(200).send({ ok: true });
});
```

- [ ] **Step 4: Ver pasar** — `pnpm --filter @holy-oly/api test me-plan` → PASS.
- [ ] **Step 5: Commit** — `git add apps/api/src/me/routes.ts apps/api/src/me-plan.int.test.ts && git commit -m "feat(api): POST /me/plan (atleta crea su propio ciclo)"`

---

### Task 3: Web — http client `createMyPlan`

**Files:**
- Modify: `apps/web/src/data/httpMeClient.ts`

**Interfaces:**
- Consumes: `SelfPlanInput` (core), `BASE`, `fail`.
- Produces: `createMyPlan(input: SelfPlanInput): Promise<void>`.

- [ ] **Step 1: Implementar** (sin test propio; cubierto por el test de UI de Task 5 y el de api de Task 2). Añadir el tipo a los imports y la función:

```ts
// imports: añadir `type SelfPlanInput` a la lista de @holy-oly/core
/** Self-coach: el atleta crea su propio plan (POST /me/plan). */
export async function createMyPlan(input: SelfPlanInput): Promise<void> {
  const res = await fetch(`${BASE}/me/plan`, {
    method: "POST", credentials: "include",
    headers: { "content-type": "application/json" }, body: JSON.stringify(input),
  });
  if (!res.ok) await fail(res);
}
```

- [ ] **Step 2: Commit** (junto a Task 4, que cierra el contrato y compila).

---

### Task 4: Web — contrato `MeClient` + singleton + `LocalMeClient`

**Files:**
- Modify: `apps/web/src/data/meClient.ts` (interface + singleton + objeto)
- Modify: `apps/web/src/data/LocalMeClient.ts` (impl offline)

**Interfaces:**
- Produces: `MeClient.createMyPlan(input: SelfPlanInput): Promise<void>` en las 3 impls.

- [ ] **Step 1:** `meClient.ts` — import `type SelfPlanInput`; añadir a la interface `createMyPlan(input: SelfPlanInput): Promise<void>;`; wrapper `export function createMyPlan(input: SelfPlanInput) { return API_ENABLED ? http.createMyPlan(input) : local().createMyPlan(input); }`; sumar `createMyPlan` al objeto `meClient`.

- [ ] **Step 2:** `LocalMeClient.ts` — implementar `createMyPlan` espejando `repo.setComps`+`savePlan`+`instantiateForPlan` con las funciones puras (escribe `KEYS.plan(id)` con comps embebidas + `KEYS.prescription(id)`). Imports a añadir: `buildAdaptivePlan, instantiatePrescription, effectiveTotalWeeks, availableWeeksToComp, mondayOf, ALL_RECIPES, type SelfPlanInput`. Método:

```ts
async createMyPlan(input: SelfPlanInput): Promise<void> {
  const today = this.today();
  const startMonday = mondayOf(today);
  const startDate = input.comp ? startMonday : input.startDate!;
  const comps = input.comp ? [{ name: input.comp.name, week: availableWeeksToComp(startMonday, input.comp.date), date: input.comp.date }] : [];
  const plan: Plan = { atletaId: this.id, macroId: input.macroId, startWeek: 1, startDate, rms: input.rms, comps };
  const macro = MACROCYCLES.find((m) => m.id === input.macroId);
  const compWeeks = comps.map((c) => c.date).filter((d): d is string => d != null).map((d) => availableWeeksToComp(startDate, d));
  const phasePlan = macro ? buildAdaptivePlan(macro, compWeeks) : [];
  const totalWeeks = macro ? effectiveTotalWeeks(macro, compWeeks) : 0;
  const rows = macro ? instantiatePrescription(ALL_RECIPES, macro, totalWeeks, phasePlan) : [];
  this.s.set(KEYS.plan(this.id), plan);
  this.s.set(KEYS.prescription(this.id), rows);
}
```
  (Verificar la firma de `JsonStore.set` y `availableWeeksToComp` durante la ejecución; ajustar `compWeeks` para usar `startDate` como en `instantiateForPlan`.)

- [ ] **Step 3: Typecheck** — `pnpm -w typecheck` (o por paquete) → 0 errores (las 3 impls satisfacen la interface).
- [ ] **Step 4: Commit** — `git add apps/web/src/data/httpMeClient.ts apps/web/src/data/meClient.ts apps/web/src/data/LocalMeClient.ts && git commit -m "feat(web): createMyPlan en el contrato MeClient (http + local)"`

---

### Task 5: Web — pantalla "Crear mi ciclo" + entrada desde Hoy

**Files:**
- Create: `apps/web/src/screens/atleta/crear/CrearCicloSheet.tsx` (form: escuela + fecha + 4 RMs + disclaimer)
- Modify: `apps/web/src/screens/atleta/HomeScreen.tsx` (empty state → CTA "Crear mi ciclo")
- Test: `apps/web/src/screens/atleta/crear/CrearCicloSheet.test.tsx`

**Interfaces:**
- Consumes: `MACROCYCLES` (catálogo, agrupar por `family`), `meClient.createMyPlan`, `BottomSheet`, patrón de RM de `AssignSheet`.

- [ ] **Step 1: Test de UI que falla** — render del sheet: elegir escuela, tipear 4 RMs y fecha de compe, submit → llama `createMyPlan` con `{ macroId, rms, comp }`; el botón está disabled hasta que RMs válidos + ancla. Verifica que los RMs NO se re-muestran tras submit.
- [ ] **Step 2: Ver fallar.**
- [ ] **Step 3: Implementar** `CrearCicloSheet.tsx` (portar `RM_FIELDS`/`validKg`/`EMPTY_RMS` de `AssignSheet`; picker de `MACROCYCLES` agrupado por `family` mostrando `name`+`frequency`+`duration`; toggle compe/inicio; disclaimer liviano; al éxito, callback `onCreated` que el Home usa para refetch). Sin mostrar RM de vuelta.
- [ ] **Step 4:** `HomeScreen.tsx` — en el bloque `!plan.plan && !preview` (líneas 83-87), añadir un CTA "Crear mi ciclo" que abre el sheet (junto al link de vincularse con coach). Al `onCreated`, re-correr el `Promise.all` de carga (extraer a un `load()` reusable).
- [ ] **Step 5: Ver pasar** — `pnpm --filter @holy-oly/web test CrearCiclo`.
- [ ] **Step 6: Commit** — `git add apps/web/src/screens/atleta/crear apps/web/src/screens/atleta/HomeScreen.tsx && git commit -m "feat(web): pantalla Crear mi ciclo desde el empty state de Hoy"`

---

### Task 6: Verificación + demo + dominio

- [ ] **Step 1:** `pnpm -w typecheck` + `pnpm -w test` (o por paquete) → todo verde.
- [ ] **Step 2:** Verificación en navegador (preview): atleta sin plan → "Crear mi ciclo" → elegir escuela + fecha + RMs → Hoy enciende con %+kg+discos.
- [ ] **Step 3:** Aviso de handoff: en Cuenta (vínculo), nota de que vincular un coach permite que reemplace el plan. (Si es chico, incluir; si no, follow-up.)
- [ ] **Step 4:** Refrescar el demo offline (`C:\HolyOlyDemo`): build web + robocopy (regla de demo permanente).
- [ ] **Step 5:** Revisión de dominio con `el-carnicero` (RM input-only, sin RPE, discos vía `Disc.tsx`).

## Self-Review

- **Cobertura del spec:** §4.1 endpoint→Task2; §4.2 schema→Task1; §4.3 cliente→Task3+4; §4.4 UI→Task5; §4.5 handoff→Task6.3; reglas dominio→Global Constraints + Task6.5; testing→cada task + Task6. ✔
- **Placeholders:** ninguno (código real en cada step; las 2 notas de "verificar firma" en Task4/Local son chequeos de ejecución, no placeholders de diseño).
- **Consistencia de tipos:** `SelfPlanInput` (Task1) usado idéntico en Task2/3/4/5; `createMyPlan(input: SelfPlanInput): Promise<void>` idéntico en las 3 impls.
