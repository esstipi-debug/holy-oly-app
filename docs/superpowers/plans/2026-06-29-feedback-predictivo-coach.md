# Feedback predictivo por racha de bienestar — Plan (Parte 2: superficie del coach)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Que el coach vea, anticipadamente, qué atleta viene en racha de bienestar malo — chip "⚠" en la mini-card del plantel + línea de rationale en el drill-down (con su carga: ACWR/readiness). Reusa el motor `wellnessStreak` de la Parte 1.

**Architecture:** Una función pura `coachStreakRisk(logs, series, today)` en core que envuelve `wellnessStreak` y le suma contexto de carga (coach-only). El **chip del plantel** se alimenta de un endpoint nuevo `GET /roster/risk` (mapa `athleteId → CoachRisk` calculado server-side, una sola llamada — sin N+1 en el cliente). La **línea del drill-down** reusa el `repo.getDaily(id)` existente (un atleta) + la `series` que el drill-down ya carga, y llama a la misma función pura. Sin migración.

**Tech Stack:** TS monorepo (pnpm), Vitest, React, Zod, Prisma, Fastify. Spec §4: `docs/superpowers/specs/2026-06-29-feedback-predictivo-bienestar-design.md`. Depende de la Parte 1 (mergeada: `wellnessStreak`, `StreakHeadsUp`, `WatchedWellnessField`).

## Global Constraints

- **El coach SÍ puede ver carga/diagnóstico** (ACWR, readiness, "sobrecarga") — HR-1 limita SOLO al atleta. Pero **sin RPE** en ninguna superficie.
- **No duplicar el semáforo**: `coachStreakRisk` dispara SOLO cuando hay racha de check-in (`wellnessStreak` ≠ null). La carga sostenida sola ya la muestra `seriesState` (no se re-alerta).
- **Sin dato → ausente**: un atleta sin racha NO aparece en el mapa `/roster/risk` (no una entrada vacía); el drill-down sin racha no muestra línea.
- **Server-side, sin N+1 en el cliente**: el plantel hace UNA llamada `/roster/risk`. El cómputo per-atleta corre en el server (o en `LocalRepository` para el demo offline).
- **Sin migración** (lee `dayLog`/`monitorWeek` existentes).
- **Reusar, no reimplementar**: `coachStreakRisk` llama a `wellnessStreak`, `acwr`, `readiness`, `readinessBand` de core. El chip/línea son copy en la capa web (coach puede nombrar "sobrecarga").

## File Structure

- `packages/core/src/logic/wellnessStreak.ts` (modify) — añade `coachStreakRisk` + tipo `CoachRisk`.
- `packages/core/src/logic/wellnessStreak.test.ts` (modify) — tests de `coachStreakRisk`.
- `packages/core/src/schemas.ts` (modify) — `CoachRiskSchema` + `RosterRiskSchema`.
- `apps/api/src/repo.ts` (modify) — `getRosterRisk(prisma, coachId, today)`.
- `apps/api/src/server.ts` (modify) — ruta `GET /roster/risk`.
- `apps/api/src/*.int.test.ts` (modify/create) — int test de la ruta.
- `packages/core/src/repository.ts` (modify) — `getRosterRisk()` en la interfaz `Repository`.
- `apps/web/src/data/HttpRepository.ts` (modify) — `getRosterRisk()` → `GET /roster/risk`.
- `apps/web/src/data/LocalRepository.ts` (modify) — `getRosterRisk()` offline.
- `apps/web/src/screens/coach/roster.ts` (modify) — `RosterRow.risk` + fetch del mapa.
- `apps/web/src/screens/coach/atletas/AtletaMiniCard.tsx` (modify) — chip de riesgo.
- `apps/web/src/screens/coach/atletas/AtletaMiniCard.test.tsx` (create/modify) — test del chip.
- `apps/web/src/screens/coach/Drilldown.tsx` (modify) — carga `getDaily` + línea de rationale.

---

## Task 1: Core `coachStreakRisk` + `CoachRisk`

**Files:**
- Modify: `packages/core/src/logic/wellnessStreak.ts`
- Modify: `packages/core/src/logic/wellnessStreak.test.ts`

**Interfaces:**
- Consumes: `wellnessStreak`, `StreakHeadsUp`, `WatchedWellnessField`, `DayLog`, `MonitorSeries`, `ReadinessBand` (existentes); `acwr` (de `./monitor`), `readiness`, `readinessBand` (de `./readiness`).
- Produces: `interface CoachRisk` y `function coachStreakRisk(logs: DayLog[], series: MonitorSeries | undefined, today: string): CoachRisk | null`.

- [ ] **Step 1: Escribir tests que fallan** (añadir a `wellnessStreak.test.ts`):

```ts
import { coachStreakRisk } from "./wellnessStreak";
import type { MonitorSeries } from "../types";

const seriesWith = (acute: number[], recovery: number[]): MonitorSeries => ({
  weeks: acute.length, acute, recovery,
  hrv: [], hrvBase: 0, rhr: [], rhrBase: 0, wellness: [],
} as unknown as MonitorSeries);

describe("coachStreakRisk", () => {
  it("sin racha de check-in → null (la carga sola la cubre el semáforo)", () => {
    const logs = ["27","28","29"].map((d) => D(`2026-06-${d}`, {})); // todos neutros
    expect(coachStreakRisk(logs, seriesWith([100,100,200,260],[60,60,60,60]), "2026-06-29")).toBeNull();
  });

  it("racha sin carga → CoachRisk con loadNote null", () => {
    const logs = ["27","28","29"].map((d) => D(`2026-06-${d}`, { sueno: 1 }));
    const r = coachStreakRisk(logs, undefined, "2026-06-29");
    expect(r).toMatchObject({ item: "sueno", days: 3, severity: "warn", acwrSustained: false, readinessBand: null, loadNote: null });
  });

  it("racha + ACWR sostenido > 1.3 dos semanas → loadNote 'sobrecarga'", () => {
    const logs = ["27","28","29"].map((d) => D(`2026-06-${d}`, { sueno: 1 }));
    // acute con 2 últimas semanas muy por encima de la base crónica → ACWR > 1.3 sostenido
    const r = coachStreakRisk(logs, seriesWith([100,100,260,280],[85,85,85,85]), "2026-06-29");
    expect(r?.acwrSustained).toBe(true);
    expect(r?.loadNote).toBe("sobrecarga");
  });
});
```

- [ ] **Step 2: Correr y verificar que falla**

Run: `pnpm --filter @holy-oly/core exec vitest run src/logic/wellnessStreak.test.ts`
Expected: FAIL (`coachStreakRisk is not a function`).

- [ ] **Step 3: Implementar** (añadir a `wellnessStreak.ts`):

```ts
import type { MonitorSeries, ReadinessBand } from "../types";
import { acwr } from "./monitor";
import { readiness, readinessBand } from "./readiness";

/** Riesgo predictivo COACH-ONLY: la racha del check-in (motor compartido) + contexto de carga
 *  (ACWR sostenido / banda de readiness). El coach SÍ ve "sobrecarga"; el atleta jamás (HR-1). */
export interface CoachRisk {
  item: WatchedWellnessField;
  days: number;
  severity: "warn" | "alert";
  alsoStreaking: WatchedWellnessField[];
  acwrSustained: boolean;               // ACWR > 1.3 en las últimas ≥2 semanas
  readinessBand: ReadinessBand | null;  // banda de la última semana (o null sin serie)
  loadNote: "sobrecarga" | null;        // la carga sostiene/amplifica el riesgo
}

const ACWR_RISK = 1.3;

/** Riesgo del coach: SOLO si hay racha de bienestar (la carga sola la cubre `seriesState`). Enriquece
 *  con ACWR sostenido + readiness. PURO. */
export function coachStreakRisk(
  logs: DayLog[], series: MonitorSeries | undefined, today: string,
): CoachRisk | null {
  const streak = wellnessStreak(logs, today);
  if (!streak) return null;

  let acwrSustained = false;
  let band: ReadinessBand | null = null;
  if (series && series.weeks >= 1) {
    const a = acwr(series.acute);
    const lastTwo = a.slice(-2).filter((v) => Number.isFinite(v));
    acwrSustained = lastTwo.length >= 2 && lastTwo.every((v) => v > ACWR_RISK);
    const lastAcwr = a.at(-1);
    band = readinessBand(readiness(series.recovery.at(-1), Number.isFinite(lastAcwr ?? NaN) ? lastAcwr : undefined));
  }
  const loadNote: "sobrecarga" | null = acwrSustained || band === "red" ? "sobrecarga" : null;
  return { ...streak, acwrSustained, readinessBand: band, loadNote };
}
```

- [ ] **Step 4: Correr y verificar que pasa**

Run: `pnpm --filter @holy-oly/core exec vitest run src/logic/wellnessStreak.test.ts`
Expected: PASS (todos, incl. los nuevos). Si algún test de carga falla por los números, ajustá `acute`/`recovery` del fixture hasta que el ACWR de las 2 últimas semanas supere 1.3 (la base crónica es media móvil de 4).

- [ ] **Step 5: Typecheck + commit**

Run: `pnpm --filter @holy-oly/core typecheck`
```bash
git add packages/core/src/logic/wellnessStreak.ts packages/core/src/logic/wellnessStreak.test.ts
git commit -m "feat(core): coachStreakRisk (racha + carga ACWR/readiness, coach-only)"
```

---

## Task 2: Schemas `CoachRisk` + server `GET /roster/risk`

**Files:**
- Modify: `packages/core/src/schemas.ts`
- Modify: `apps/api/src/repo.ts`
- Modify: `apps/api/src/server.ts`
- Modify: `apps/api/src/server.int.test.ts`

**Interfaces:**
- Consumes: `coachStreakRisk` (Task 1), `toDayLog`/`getSeries` (existentes en repo.ts).
- Produces: `CoachRiskSchema`, `RosterRiskSchema`; `repo.getRosterRisk(prisma, coachId, today): Promise<Record<string, CoachRisk>>`; ruta `GET /roster/risk`.

- [ ] **Step 1: Schemas** (en `schemas.ts`, junto a `StreakHeadsUpSchema`):

```ts
export const CoachRiskSchema = z.object({
  item: z.enum(["sueno", "estres", "fatiga", "dolor", "motivacion"]),
  days: z.number().int().positive(),
  severity: z.enum(["warn", "alert"]),
  alsoStreaking: z.array(z.enum(["sueno", "estres", "fatiga", "dolor", "motivacion"])),
  acwrSustained: z.boolean(),
  readinessBand: z.enum(["green", "amber", "red"]).nullable(),
  loadNote: z.enum(["sobrecarga"]).nullable(),
});
/** Mapa athleteId → riesgo. Sólo atletas CON racha (ausente = sin riesgo). */
export const RosterRiskSchema = z.record(z.string(), CoachRiskSchema);
```

- [ ] **Step 2: Repo helper** (en `repo.ts`, junto a `getRoster`):

```ts
import { coachStreakRisk, type CoachRisk } from "@holy-oly/core"; // añadir al import de core existente

/** Riesgo predictivo por atleta del coach (mapa). Server-side: N consultas locales, 1 respuesta.
 *  Sólo entra el atleta CON racha de bienestar. */
export async function getRosterRisk(prisma: PrismaClient, coachId: string, today: string): Promise<Record<string, CoachRisk>> {
  const vinculos = await prisma.vinculo.findMany({ where: { coachId, estado: "activo" }, select: { athleteId: true } });
  const out: Record<string, CoachRisk> = {};
  for (const { athleteId } of vinculos) {
    const recent = await prisma.dayLog.findMany({ where: { athleteId }, orderBy: { date: "desc" }, take: 14 });
    const series = await getSeries(prisma, athleteId);
    const risk = coachStreakRisk(recent.map(toDayLog), series, today);
    if (risk) out[athleteId] = risk;
  }
  return out;
}
```

- [ ] **Step 3: Ruta** (en `server.ts`, justo después del bloque `app.get("/roster", ...)` en línea ~181). Usá el mismo `requireCoach` y un `today` ISO (si no hay helper, inline `new Date().toISOString().slice(0,10)`):

```ts
  app.get("/roster/risk", async (req, reply) => {
    const coachId = requireCoach(req, reply);
    if (!coachId) return;
    return repo.getRosterRisk(prisma, coachId, new Date().toISOString().slice(0, 10));
  });
```

- [ ] **Step 4: Int test** (añadir a `server.int.test.ts`, dentro del describe del coach):

```ts
  it("GET /roster/risk → mapa (200, coach autenticado)", async () => {
    const headers = await loginCoach(app); // usar el helper de login existente en el archivo
    const res = await app.inject({ method: "GET", url: "/roster/risk", headers });
    expect(res.statusCode).toBe(200);
    expect(typeof res.json()).toBe("object"); // mapa (posiblemente vacío según seed)
  });
  it("GET /roster/risk sin auth → 401/403", async () => {
    const res = await app.inject({ method: "GET", url: "/roster/risk" });
    expect([401, 403]).toContain(res.statusCode);
  });
```
(Adaptá `loginCoach`/headers al helper real del archivo — mirá el test vecino de `/roster`.)

- [ ] **Step 5: Verificar + commit**

Run: `pnpm --filter @holy-oly/core typecheck && pnpm --filter @holy-oly/api test 2>&1 | tail -20` (ajustá el filtro al nombre real del paquete api).
```bash
git add packages/core/src/schemas.ts apps/api/src/repo.ts apps/api/src/server.ts apps/api/src/server.int.test.ts
git commit -m "feat(api): GET /roster/risk — mapa de riesgo predictivo del plantel (coach)"
```

---

## Task 3: `Repository.getRosterRisk` (interfaz + Http + Local)

**Files:**
- Modify: `packages/core/src/repository.ts`
- Modify: `apps/web/src/data/HttpRepository.ts`
- Modify: `apps/web/src/data/LocalRepository.ts`
- Modify: `apps/web/src/data/HttpRepository.test.ts` (si testea contratos) y/o un test local

**Interfaces:**
- Consumes: `CoachRisk`, `RosterRiskSchema`, `coachStreakRisk` (core).
- Produces: `Repository.getRosterRisk(): Promise<Record<string, CoachRisk>>` implementado en ambos.

- [ ] **Step 1: Interfaz** (en `repository.ts`, junto a `getRoster`): añadir
```ts
  /** Riesgo predictivo por atleta (racha de bienestar + carga). Sólo atletas CON racha. {} sin ninguno. */
  getRosterRisk(): Promise<Record<string, CoachRisk>>;
```
(añadir `CoachRisk` al import de tipos del archivo.)

- [ ] **Step 2: HttpRepository** (junto a `getRoster`):
```ts
  async getRosterRisk(): Promise<Record<string, CoachRisk>> {
    return this.get("/roster/risk", RosterRiskSchema);
  }
```
(importar `RosterRiskSchema` y el tipo `CoachRisk`.)

- [ ] **Step 3: LocalRepository** (offline, junto a `getRoster`): computa con la misma función pura desde el localStorage seedeado:
```ts
  async getRosterRisk(): Promise<Record<string, CoachRisk>> {
    const today = new Date().toISOString().slice(0, 10);
    const roster = await this.getRoster();
    const out: Record<string, CoachRisk> = {};
    for (const a of roster) {
      const logs = DayLogsSchema.safeParse(this.s.getOptional<unknown>(KEYS.dayLog(a.id)));
      const series = MonitorSeriesSchema.safeParse(this.s.getOptional<unknown>(KEYS.series(a.id)));
      const risk = coachStreakRisk(logs.success ? logs.data : [], series.success ? series.data : undefined, today);
      if (risk) out[a.id] = risk;
    }
    return out;
  }
```
(importar `coachStreakRisk`, `DayLogsSchema`, `MonitorSeriesSchema`, `CoachRisk`, `KEYS` ya está.)

- [ ] **Step 4: Stubs de tests** — si hay un `MeClient`/`Repository` stub en tests que TS exige completo, añadir `getRosterRisk: async () => ({})`. Buscar con: `grep -rl "getRoster:" apps/web/src --include=*.test.* ` y completar los que tipan `Repository`.

- [ ] **Step 5: Verificar + commit**

Run: `pnpm -r typecheck && pnpm --filter @holy-oly/web test 2>&1 | tail -20`
```bash
git add packages/core/src/repository.ts apps/web/src/data/HttpRepository.ts apps/web/src/data/LocalRepository.ts apps/web/src/data/*.test.ts
git commit -m "feat(core,web): Repository.getRosterRisk (http + offline)"
```

---

## Task 4: Chip en la mini-card + línea en el drill-down

**Files:**
- Modify: `apps/web/src/screens/coach/roster.ts`
- Modify: `apps/web/src/screens/coach/atletas/AtletaMiniCard.tsx`
- Modify: `apps/web/src/screens/coach/atletas/AtletaMiniCard.test.tsx`
- Modify: `apps/web/src/screens/coach/Drilldown.tsx`

**Interfaces:**
- Consumes: `repo.getRosterRisk()` (Task 3), `repo.getDaily(id)` (existente), `CoachRisk`.
- Produces: `RosterRow.risk`; chip en la mini-card; línea de rationale en el drill-down.

- [ ] **Step 1: `RosterRow.risk` + fetch** (en `roster.ts`): añadir `risk: CoachRisk | null` a `RosterRow`; en `getRosterRows`, traer el mapa una vez y mapear:
```ts
const risk = await repo.getRosterRisk();
// ... dentro del map: risk: risk[a.id] ?? null,
```
(importar `CoachRisk`.)

- [ ] **Step 2: Chip en `AtletaMiniCard`** — texto compacto coach-facing (puede nombrar carga). Helper de label:
```ts
const ITEM_SHORT: Record<string, string> = { sueno: "Sueño", estres: "Estrés", fatiga: "Fatiga", dolor: "Dolor", motivacion: "Motiv." };
function riskLabel(r: CoachRisk): string {
  return r.loadNote === "sobrecarga" ? "Riesgo sobrecarga" : `${ITEM_SHORT[r.item]} ${r.days}d`;
}
```
Renderizar un pill (reusar el estilo del pill `needsRm` que ya existe en el archivo, cambiando color por severidad vía `STATUS[r.severity === "alert" ? "alert" : "warn"]`) cuando `row.risk` no es null. Texto `⚠ {riskLabel(row.risk)}`.

- [ ] **Step 3: Test del chip** (en `AtletaMiniCard.test.tsx`): un caso con `row.risk = { item:"sueno", days:4, severity:"alert", alsoStreaking:[], acwrSustained:true, readinessBand:"red", loadNote:"sobrecarga" }` → assert que aparece `/Riesgo sobrecarga/`; un caso con `row.risk = null` → assert que NO aparece `/Riesgo|⚠/` (más allá del de `needsRm`). Reusar el render helper existente del archivo o de un sibling test.

- [ ] **Step 4: Línea en el drill-down** (en `Drilldown.tsx`): en el `Promise.all` de carga (línea ~68) añadir `repo.getDaily(id)`; guardar en estado `daily`. Derivar:
```ts
const risk = useMemo(
  () => (daily ? coachStreakRisk(daily.checkins.map((c) => ({ ...c })), series, daily.today) : null),
  [daily, series],
);
```
Renderizar, cuando `risk` no es null, una línea coach-facing arriba del contenido del drill-down (cerca del Monitor), p.ej.:
```tsx
{risk && (
  <div role="status" style={{ /* estilo de alerta del archivo */ }}>
    {`${ITEM_SHORT[risk.item]} bajo ${risk.days} días seguidos`}
    {risk.acwrSustained ? " · ACWR sostenido >1,3" : ""}
    {risk.readinessBand === "red" || risk.readinessBand === "amber" ? ` · readiness ${risk.readinessBand}` : ""}
    {risk.loadNote === "sobrecarga" ? " → riesgo de sobrecarga si no descarga." : "."}
  </div>
)}
```
(`DailyCheckin` y `DayLog` son estructuralmente idénticos — el `.map((c) => ({ ...c }))` produce `DayLog[]`. Importar `coachStreakRisk`, `ITEM_SHORT`.)

- [ ] **Step 5: Verificar + commit**

Run: `pnpm --filter @holy-oly/web typecheck && pnpm --filter @holy-oly/web test 2>&1 | tail -20`
```bash
git add apps/web/src/screens/coach/roster.ts apps/web/src/screens/coach/atletas/AtletaMiniCard.tsx apps/web/src/screens/coach/atletas/AtletaMiniCard.test.tsx apps/web/src/screens/coach/Drilldown.tsx
git commit -m "feat(web): chip de riesgo en la mini-card + línea en el drill-down (coach)"
```

---

## Verificación final (Parte 2)

- [ ] `pnpm -r typecheck` y `pnpm -r test` verdes.
- [ ] Preview: con un atleta del plantel en racha (inyectar `ho:daylog:<id>` como en la Parte 1), su mini-card muestra el chip "⚠"; al entrar al drill-down, aparece la línea de rationale con la carga.
- [ ] HR-1: confirmar que NADA de esto aparece en superficie del atleta (solo `/coach/*`).
- [ ] `pnpm lint` sin nuevos errores.
