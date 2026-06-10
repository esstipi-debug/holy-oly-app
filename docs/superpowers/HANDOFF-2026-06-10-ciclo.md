# HANDOFF — Holy Oly: ciclo visible Capas 1–2 (sesión 2026-06-10 c)

- **Fecha:** 2026-06-10 (tercera entrega del día: heatmap+anclaje → SP5 → ciclo)
- **Para:** retomar sin perder contexto. Complementa `HANDOFF-2026-06-10-sp5.md` y `HANDOFF-GO-LIVE.md`.

---

## 0. Resumen en una línea

**SHIPPED:** la atleta registra su ciclo (opt-in en Cuenta), lo ve **proyectado sobre su mapa del
plan** (dots neutros: período / pre-período + contexto del día + colisión semana-pesada∩ventana),
y el coach recibe SOLO el chip redactado con **`inLutealNow` real** (era placeholder). Migración
**17_cycle_fields** (cifrado at-rest). Capa 3 (proponer ajustes de carga por ciclo) queda para
**readiness→modulación post-motor** — decisión explícita del owner.

## 1. Estado git

| Hecho | Detalle |
|---|---|
| Rama | `claude/nifty-lumiere-6f1195` (mismo worktree de SP5) — FF a `main` local, **SIN push** |
| Commits del slice | `27849ff` spec · `80ec337` plan · `5298147` core · `9531e24` api (mig 17) · `0c995df` web data · `7d71f1f` mocks · `66aaf16` Cuenta · `acecff3` overlay · `0e2c65e` chip coach · `7674a1d` fixes reviews · (+ este handoff) |
| **WIP booking** | Sigue sin commitear en el checkout principal. **Su migración renumera 15 → 18** (SP5 tomó la 16, el ciclo la 17) |
| Migraciones | 0–14 + 16 + **17_cycle_fields** |

## 2. Qué se construyó

Spec: `docs/superpowers/specs/2026-06-10-ciclo-visible-design.md` · Plan:
`docs/superpowers/plans/2026-06-10-ciclo-visible.md` (C0–C8, TDD).

- **Core `logic/cycle.ts`** (constantes nombradas v1, criterio ajustable): período = días 0–4 ·
  pre-período = últimos 5 · lútea = últimos 14 · horizonte 3 ciclos (decae a null) · len 21–45 ·
  SOLO `state:"regular"` proyecta · jamás al pasado. **`redactCycle` MOVIDO a core**
  (`apps/api/src/cycle.ts` borrado; API y LocalRepository consumen la misma función — anclas del
  rulebook actualizadas).
- **API**: `GET/PUT /me/cycle` (requireAthlete, Zod 21–45, **cifrado at-rest los 4 campos**, audit
  `cycle.write` SIN payload de salud) · `getCycle` coach computa lúteo SOLO bajo share full +
  regular + datos · export D3 descifra los campos nuevos · `me-cycle` y D1 cubiertos por int tests
  (roundtrip, ciphertext, redacción exacta por keys, 401, no-leak por regex en el wire).
- **Web atleta**: sección **«Ciclo · registro opcional»** en Cuenta (share Nada/Mínimo/Contexto con
  copy honesto de qué ve el coach, estado con derivación sobria para amenorrea y nota de
  no-proyección para irregular, aviso de horizonte vencido) · **overlay** en su mapa
  (`PlanHeatMap.cycleMarks`, dot sólido = período, hueco = pre-período, paleta neutra de
  `--wl-text`, aria-labels) · leyenda + **nota HR-2 del cómo-se-forma** · línea de contexto del día
  («proyección según tu registro — contexto, no regla») · línea de colisión. **El overlay es de
  ELLA: independiente del share** (compartir es hacia el coach).
- **Web coach**: una línea muted en el drill-down: «Ciclo · compartido — contexto lúteo hoy:
  sí/no/—» (min → «compartido (mínimo)»; salud → «derivación sugerida»; none → nada). Paleta
  neutra, jamás semáforo.
- **Local/demo espejo completo**: meClient + LocalMeClient + LocalRepository con lúteo real;
  seeds: **mv y kv** con ciclo demo (día ~20 de 28 → lútea hoy).

## 3. Reviews

**El Carnicero** — cazó **1 CRITICAL**: fecha degenerada (`2026-99-99`) pasaba el regex y el NaN
sobrevivía los guards → `lutealNow` fabricaba un «no» para el coach donde va «—». Fix: guard
`Number.isFinite` en `cycleDayOf` + **refine de calendario en `IsoDateSchema`** (afecta a todos sus
usos, para bien) + validación de formato en el Local. +1 HIGH HR-2 (nota del cómo-se-forma, ya
visible junto a la leyenda) +1 MEDIUM (aviso de horizonte en Cuenta) +1 LOW (anclas del rulebook).
**React** — 0 CRITICAL/HIGH; aplicados: a11y del input de duración (aria-describedby + role=alert),
role="status" en la colisión, type="text" explícito. **No aplicado (consciente):** patrón
mountedRef de CicloSection (mismo idiom que RmSection shipped), spread condicional de props
opcionales (idiom del repo), incertidumbre visual creciente por ciclo (fuera de rulebook).

## 4. Verificación

`pnpm -r typecheck` ✓ · core **200** · web **306** · api **50 unit + 73 int** · lint 0 errors
(warning preexistente). **Smoke en vivo sobre `:8765`** (la instancia del owner, build nuevo,
mig 17 aplicó sobre el estado heat existente): PUT como Mara → fila cruda **cifrada** (`enc:v1:` —
el runner SÍ tiene la clave) → coach `{share:"full",inLutealNow:true,health:"ok",reliable:true}`
(payload EXACTO, lúteo computado) → DOM coach: chip visible + **leak false** + RMs de SP5 intactos
→ DOM atleta: Cuenta con los valores cargados + **19 celdas marcadas** en su mapa + leyenda + nota
de derivación. Colisión null honesto (su semana pesada no cruza ventana en horizonte).

## 5. Instancia del owner (`:8765`) — corriendo con TODO (SP5 + ciclo)

- **Estado demo dejado a propósito:** Mara con ciclo registrado (full/regular, inicio hace ~20
  días, 28) → en su mapa se ven las ventanas y el coach ve «contexto lúteo hoy: sí». La cuenta
  `atleta@holyoly.dev` (demo-atleta) también quedó con un registro (artefacto del smoke, inocuo).
- ⚠ **Gotcha del smoke:** `?as=atleta` en esta instancia NO es Mara — es `atleta@holyoly.dev`.
  Para tocar datos de Mara vía `/me/*`: login real `mara@holyoly.dev / holyoly-demo`.
- Rebuild: receta de siempre desde el worktree **nifty-lumiere-6f1195**. OJO: `prisma generate`
  requiere matar la instancia primero (lockea el DLL del engine) — relanzar después.

## 6. Qué NO es este slice (para no confundir alcances)

- **NO modula cargas** (ni propone −%): eso es Capa 3 = señal del motor de **readiness→modulación**
  (post-Prilepin), patrón SP4 (propuesta → tap → actuals).
- **NO hay registro día-a-día de síntomas**, ni bandas de fase sobre los charts de
  recuperación/IMR, ni nota de contexto en la recomendación del monitor, ni señal en el triage de
  compe — todo eso sigue siendo el diseño del módulo completo (memoria `ciclo-menstrual-module`).
- **El semáforo NO se enteró** del ciclo (regla dura; verificado por El Carnicero).

## 7. Roadmap vigente (sin cambios)

1. Bugs que reporte el owner sobre `:8765` (ahora con SP5 + ciclo adentro).
2. **Motor Prilepin core dormant** (leer ANTES `2026-06-09-bundle-reconciliacion-vs-holyoly.md`).
3. Readiness→modulación (acá entra el ciclo como señal — Capa 3) → peaking → app-viva.
4. Pendientes previos: recetas para los otros 23 macros, adapter MP real, email real, legal, i18n,
   booking (mig → 18), borrar a mano `C:\HolyOlyDemo-sp5-smoke`.
