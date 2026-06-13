# Plan — Legal, privacidad y consentimiento (incl. ciclo menstrual)

> **✅ IMPLEMENTADO 2026-06-13 (mismo commit):** el código de PR-L1 (aceptación legal en signup) y
> PR-L2 (consentimiento explícito del ciclo) + texto legal v1 está SHIPPED y testeado (core 391 · web
> 463 · api int 104). Lo que sigue pendiente es contenido/decisiones, NO código: el **texto legal final
> por un abogado** (lo shippeado es un borrador v1 honesto con disclaimer) y la **Fase 0** (decisión de
> región de datos E8 + brief legal). El módulo de ciclo ya cumple §3 con opt-in informado, revocación y
> redacción server-side.
>
> **Alcance original:** Solo plan. Implementación en PRs separados.
> **Origen:** Auditoría de producto 2026-06-13.
> **Revisión 2026-06-13b (esta versión):** baseline **re-verificado contra el código real**. El plan
> original asumía un estado más vacío del que existe — export/borrado de cuenta, la API de ciclo y casi
> toda la UI de ciclo **ya están construidas y testeadas**. El alcance de código nuevo es **mucho menor**
> de lo que sugería el documento original. Las celdas de estado abajo citan `archivo:línea` verificados.
> **Constitution:** `docs/domain/HOLY-OLY-DOMAIN.md` §3, `docs/adr/2026-06-07-data-region.md`,
> `docs/superpowers/specs/2026-06-07-security-improvement-plan.md` (D1/D3/D4/E8)

**Meta:** Pasar de **stubs legales + mención en signup** a **documentos revisables + trazabilidad de
aceptación + consentimiento explícito del ciclo**, alineado con dominio y la API/UI ya existentes.

---

## Cambios de esta revisión vs. el plan original

El plan original (pegado en chat, sin archivo en repo) describía como pendientes varias piezas que **ya
están en producción**. Correcciones aplicadas tras verificar el código:

| Afirmación del plan original | Realidad verificada 2026-06-13 |
|---|---|
| "Export/borrado: no expuestos en UI atleta" | ✅ **Ya hecho** — `TusDatosSection` en [CuentaMin.tsx:127](../../../apps/web/src/screens/atleta/CuentaMin.tsx) (exportar JSON + borrar con confirmación fuerte + logout) |
| Task 2.2 "Create rutas `/me/cycle`" | ✅ **Ya existen** — `GET`+`PUT /me/cycle` en [me/routes.ts:78](../../../apps/api/src/me/routes.ts), con Zod (`PutMeCycleInputSchema`), audit `cycle.write` y cifrado D1 |
| Task 2.3 "Create `CycleConsentSheet.tsx`" | ⚠️ **Ya existe `CicloSection.tsx`** con share none/min/full, estado regular/irregular/amenorrea, paleta neutra y copy médico sobrio — falta SOLO el paso de consentimiento explícito |
| Ref `CuentaStub.tsx` (coach) | Stale: hoy es [CuentaCoach.tsx:97](../../../apps/web/src/screens/coach/macros/CuentaCoach.tsx) y **ya enlaza** /privacidad y /terminos |
| "Sin UI atleta para activar/editar/revocar ciclo" | Parcialmente falso: **editar** ya funciona; falta el **activar/consentir** explícito y `revocar` one-tap claro |

**Lo que queda como gap real de código (alcance verdadero):**

1. 🔴 **Aceptación legal en signup** (PR-L1 / Task 1.3) — único gap limpio de PR-L1. No depende del texto legal final.
2. 🟠 **Paso de consentimiento explícito del ciclo** (PR-L2) — opt-in que arranca invisible + checkbox informado + `consentVersion/consentedAt` (ausentes del schema).
3. ⚪ **Texto legal final + región de datos** — bloqueado por Fase 0 (owner) y asesoría legal. No es código.

---

## Estado actual (baseline VERIFICADO 2026-06-13)

| Área | Qué hay (verificado) | Gap real |
|------|----------------------|----------|
| **Rutas legales** | `/privacidad`, `/terminos` en router; [LegalPages.tsx](../../../apps/web/src/screens/legal/LegalPages.tsx) con texto borrador real + banner "Borrador · requiere revisión legal" | Texto = borrador; **copy stale** "(cuando la API esté habilitada)" en [LegalPages.tsx:45](../../../apps/web/src/screens/legal/LegalPages.tsx) — la API ya está habilitada; sin versionado |
| **Signup** | Copy "Al registrarte aceptás…" en [AuthScreen.tsx:177](../../../apps/web/src/auth/AuthScreen.tsx) | ❌ **Sin checkbox obligatorio; sin registro server-side de versión/fecha** |
| **Schema `User`** | [schema.prisma:64](../../../apps/api/prisma/schema.prisma) | ❌ **Sin `termsAcceptedAt/termsVersion/privacyAcceptedAt/privacyVersion`** |
| **API ciclo** | `GET`+`PUT /me/cycle` ([me/routes.ts:78](../../../apps/api/src/me/routes.ts)); Zod `PutMeCycleInputSchema`; audit `cycle.write`; cifrado D1; coach solo recibe `CycleContext` redactado (audit `cycle.read` en [server.ts:215](../../../apps/api/src/server.ts)) | Falta `DELETE /me/cycle` explícito (hoy se revoca con `share:none`); audit no distingue consent/revoke |
| **UI ciclo** | [CicloSection.tsx](../../../apps/web/src/screens/atleta/CicloSection.tsx) en Cuenta: share none/min/full (con copy de qué ve el coach), estado regular/irregular/amenorrea (derivación médica sobria), inicio/duración, paleta neutra | ⚠️ **Sin paso de activación explícito** (el módulo está siempre visible) ni checkbox de consentimiento informado |
| **Schema `CycleConsent`** | [schema.prisma:340](../../../apps/api/prisma/schema.prisma): `share`, `state`, `lastPeriodStart`, `cycleLengthDays` (todo cifrado at-rest) | ❌ **Sin `consentVersion` ni `consentedAt`** |
| **Derechos (export/borrado)** | API `GET /me/export` + `DELETE /me/account` ([me/routes.ts:122](../../../apps/api/src/me/routes.ts)) **y UI** `TusDatosSection` ([CuentaMin.tsx:127](../../../apps/web/src/screens/atleta/CuentaMin.tsx)) | ✅ **Completo (atleta).** Coach: definir scope de export (perfil/suscripción) |
| **Discoverability legal** | Footer atleta ([CuentaMin.tsx:272](../../../apps/web/src/screens/atleta/CuentaMin.tsx)) **y coach** ([CuentaCoach.tsx:97](../../../apps/web/src/screens/coach/macros/CuentaCoach.tsx)) enlazan /privacidad + /terminos; footer auth en signup | ✅ **Hecho.** Quitar banner "borrador" al aprobar `v1` |
| **Región de datos** | ADR E8 propuesto (US-Oregon); privacidad ya lo declara + transferencia internacional | Decisión owner pendiente (Fase 0) |
| **Dominio §3 ciclo** | opt-in por elección, redacción server-side, paleta neutra, amenorrea sin gamificar | El comportamiento ya cumple §3; falta formalizar el **acto de consentimiento** |

**Tests existentes que cubren el baseline:** `cycle-data.int.test.ts` (roundtrip + 401), `me-export-delete.int.test.ts` (D3/D4), `audit.int.test.ts` (`cycle.read`). El aislamiento coach (nunca ve `state` crudo) ya está cubierto.

**No objetivo de este plan:** redactar el texto legal final (abogado), migrar la región de datos (Opción 2 ADR), ni certificaciones (ISO, HIPAA, etc.).

---

## Fase 0 — Decisiones owner y contenido (1–3 días calendario, paralelo a dev)

**Goal:** Desbloquear redacción y evitar re-trabajo. _(Sin cambios respecto al plan original — sigue válida y es la dependencia dura del texto legal.)_

### Task 0.1: Decisión región de datos (E8)
- [ ] Owner elige **Opción 1** (US + consentimiento + aviso) u **Opción 2** (mover región).
- [ ] Actualizar `docs/adr/2026-06-07-data-region.md` → **Aceptado** con la opción elegida.
- [ ] Definir entidad legal responsable (nombre, CUIT/RUT si aplica, domicilio, email `privacy@…` real).

> ⚠️ Hoy el contacto real operativo es `esstipi@gmail.com` (stopgap, deploy `220e395`); el dominio `holyoly.app` está parqueado. La privacidad ya usa ese contacto provisorio.

### Task 0.2: Brief para asesoría legal
Entregar al abogado (LatAm / datos sensibles): tipos de dato (entrenamiento, bienestar/daylog, **ciclo menstrual opt-in**, auth, facturación coach); flujos (coach↔atleta por vínculo; redacción ciclo coach vía `CycleContext`; export/borrado atleta); infra (Render Oregon, Postgres, email Google, Mercado Pago, Google OAuth). Preguntas: ¿categoría "datos sensibles" del ciclo en AR? ¿base legal de transferencia a US? ¿edad mínima?

### Task 0.3: Versionado de documentos
- [ ] Convención: `legal/privacidad/v1.md`, `legal/terminos/v1.md` (markdown con `version` + `effectiveDate`).
- [ ] Registrar en repo la **versión vigente** que el signup debe aceptar (constante compartida core ↔ web ↔ api).

**Gate:** Owner + versión `v1` de privacidad/términos aprobados para **beta cerrada** (puede ser "beta legal" con disclaimer).

---

## Fase 1 — Aceptación legal en signup + contenido versionado (PR-L1)

**Goal:** Trazabilidad de aceptación + texto versionado. **El grueso de PR-L1 ya está hecho** (export/borrado UI, discoverability). Esta fase se reduce a **un gap de código (Task 1.3)** + maquetar el texto cuando llegue.

**Files (verificados):**
- Modify: [apps/api/prisma/schema.prisma](../../../apps/api/prisma/schema.prisma) — campos legales en `User`
- Create: `apps/api/prisma/migrations/<n>_user_legal_acceptance/` — **n ≥ 19** (la 18 `SessionRegistro` ya está en prod; el booking WIP reserva la 19 — confirmar numeración libre antes de crear)
- Modify: `apps/api/src/auth/routes.ts` — signup coach/atleta exige aceptación
- Modify: [apps/web/src/auth/AuthScreen.tsx](../../../apps/web/src/auth/AuthScreen.tsx) — checkbox obligatorio
- Modify: [apps/web/src/screens/legal/LegalPages.tsx](../../../apps/web/src/screens/legal/LegalPages.tsx) — render versionado + fix copy stale
- Create: `legal/privacidad/v1.md`, `legal/terminos/v1.md` (contenido owner/abogado)

### Task 1.1 / 1.2: Texto versionado (BLOQUEADO por Fase 0)
Estructura/maquetado se puede preparar; el **contenido** lo da el abogado. Secciones obligatorias de privacidad: responsable, datos tratados (tabla categoría/ejemplos/obligatorio-u-opt-in), finalidad y base legal, **ubicación y transferencia internacional** (ADR E8), subprocesadores (Render, email, pagos, Google), conservación, **derechos**, **datos de ciclo menstrual** (subsección), seguridad, menores/cambios/reclamos. Términos: servicio (coordinación, no clínica), elegibilidad, roles, **exención médica**, suscripción coach, IP/uso aceptable, limitación de responsabilidad, ley aplicable.
- [ ] Fix inmediato y barato (no requiere abogado): corregir copy stale "(cuando la API esté habilitada)" en [LegalPages.tsx:45](../../../apps/web/src/screens/legal/LegalPages.tsx) — la API ya está viva.

### Task 1.3: Persistir aceptación legal en signup 🔴 **(único gap de código de PR-L1)**

```prisma
model User {
  // ...
  termsAcceptedAt   DateTime?
  termsVersion      String?   // ej. "terminos/v1"
  privacyAcceptedAt DateTime?
  privacyVersion    String?   // ej. "privacidad/v1"
}
```

- [ ] Signup (coach **y** atleta): checkbox **obligatorio** "Leí y acepto Términos y Privacidad" con links. El `signup()` del front (hoy `signup(email, password, role, name, website)`) pasa la aceptación.
- [ ] API rechaza signup sin `acceptTerms: true` + versiones (enviadas o inferidas del servidor). Reusar el patrón de error en español de [AuthScreen.tsx:18](../../../apps/web/src/auth/AuthScreen.tsx) (`authErrorMessage`).
- [ ] Usuarios existentes: migración con `termsAcceptedAt = createdAt` + versión `v0-stub`, **o** forzar re-aceptación en próximo login (decisión producto — ver Task 3.3).

**Tests:** `auth` int test — 400 sin aceptación; 201 con aceptación y campos persistidos.

### Task 1.4: Cuenta export/borrado — ✅ **YA HECHO (no hacer)**
`TusDatosSection` ([CuentaMin.tsx:127](../../../apps/web/src/screens/atleta/CuentaMin.tsx)) ya cablea `GET /me/export` (descarga JSON) y `DELETE /me/account` (confirmación fuerte + logout). Backend con audit `data.export` / `account.delete`. **Pendiente menor:** definir si el coach necesita su propio export (scope perfil/suscripción, NO datos de atletas).

### Task 1.5: Footer y discoverability — ✅ **YA HECHO (no hacer)**
Footer atleta + coach ya enlazan legal. **Pendiente:** quitar/acotar el banner "Borrador" cuando `v1` esté aprobado (hoy correcto que siga visible).

**Gate PR-L1:** Signup no completa sin aceptación; campos persistidos; copy stale corregido; (texto `v1` cuando exista).

---

## Fase 2 — Consentimiento explícito del ciclo (PR-L2)

**Goal:** Cumplir §3 dominio: opt-in **por elección**, consentimiento **informado**, revocable. **La API y la UI de edición ya existen y cumplen redacción/paleta/amenorrea.** Esta fase agrega el **acto de consentimiento** sobre lo construido — no reconstruye el módulo.

**Referencias código:** `CycleConsent` ([schema.prisma:340](../../../apps/api/prisma/schema.prisma)), `redactCycle`/`CycleContext` (core + [server.ts:215](../../../apps/api/src/server.ts)), [CicloSection.tsx](../../../apps/web/src/screens/atleta/CicloSection.tsx), `PutMeCycleInputSchema` (core).

### Task 2.1: Spec de producto (1 página)
**Create:** `docs/superpowers/specs/2026-06-13-cycle-consent-design.md`. Debe fijar: **activación** (módulo invisible hasta que la atleta pulsa "Activar" en Cuenta — hoy `CicloSection` se muestra siempre); **nunca** pre-llenar por género; mapeo `none|min|full` → copy humano (ya redactado en `CicloSection`, reusarlo); qué ve el coach por nivel (proyección redactada — ya implementado); amenorrea = derivación sobria (ya implementado); **desactivar** = `share:none` o borrar fila (decidir; preferible conservar fila con `none` + audit).

### Task 2.2: API atleta ciclo — ✅ **CASI COMPLETA**
`GET`+`PUT /me/cycle` ya existen con Zod + audit `cycle.write` + cifrado D1, y los tests `cycle-data.int.test.ts` verifican roundtrip, 401 y que el coach nunca recibe `state` crudo. **Lo que falta (chico):**
- [ ] **Schema:** agregar `consentVersion String?` + `consentedAt DateTime?` a `CycleConsent` (+ migración n ≥ 19, cifrado igual que el resto si aplica). Hoy **no existen** ([schema.prisma:340](../../../apps/api/prisma/schema.prisma)).
- [ ] `PUT /me/cycle`: en la **primera activación** exigir `consentVersion` y sellar `consentedAt`. Extender `PutMeCycleInputSchema` en core.
- [ ] (Opcional) `DELETE /me/cycle` explícito para revocación one-tap; o documentar que `share:none` es la revocación canónica.
- [ ] **Audit:** hoy hay un único `cycle.write` ([me/routes.ts:91](../../../apps/api/src/me/routes.ts)). Evaluar distinguir `cycle.consent` (primera activación) y `cycle.revoke` (a `none`) — sin PII, igual que el resto.

**Tests:** extender `cycle-data.int.test.ts` — primera activación exige consentimiento; regresión: coach sigue sin recibir `state` crudo.

### Task 2.3: UI — paso de consentimiento (refinar lo existente)
No crear un módulo nuevo: **envolver `CicloSection` con un gate de activación**.
- [ ] Estado "no activado" (sin fila `CycleConsent` / sin `consentedAt`): mostrar intro — para qué sirve, qué **no** hace (no semáforo, no prescripción rígida) — con botón "Activar".
- [ ] Al activar: checkbox "Entiendo que esto no reemplaza consejo médico…" + link a la § ciclo de privacidad; recién entonces se habilita el `PUT` con `consentVersion` (`cycle-consent/v1`).
- [ ] Editar/revocar posterior desde la misma sección (ya existe el form); revocación clara.
- [ ] **Estilo:** mantener la paleta **neutra** ya usada (§3 — nunca verde/amarillo/rojo de estado).
- [ ] **Repository:** seguir usando `meClient.getMeCycle/putMeCycle` (ya en uso por `CicloSection`) — sin `fetch` en la screen.

### Task 2.4: Ampliar privacidad § ciclo
Sincronizar texto legal con el flujo real: datos tratados (regularidad, amenorrea…), retención hasta borrado de cuenta, revocación con efecto inmediato (`share:none` → el coach deja de ver contexto). (Depende del texto `v1`.)

**Gate PR-L2:** El Carnicero §3 — opt-in explícito (acto de consentimiento registrado), redacción server-side intacta, sin semáforo en UI ciclo, amenorrea sin tono celebratorio. Tests de aislamiento del coach verdes.

---

## Fase 3 — Complementos y go-live legal (PR-L3, ~1–2 días)

_(Sin cambios mayores respecto al plan original.)_

### Task 3.1: Cookies y tecnologías similares
- [ ] Inventariar: sesión cookie, Google OAuth, Mercado Pago, analytics (si hubiera). Si hay cookies no esenciales: página `/cookies` + banner; enlazar desde privacidad.

### Task 3.2: Subprocesadores
- [ ] Tabla en privacidad (proveedor, finalidad, país, enlace a su DPA) + `docs/legal/subprocessors.md` interno.

### Task 3.3: Re-aceptación ante cambios
- [ ] Si `privacyVersion`/`termsVersion` sube en servidor, el login flow fuerza re-lectura a usuarios con versión antigua. Log audit `legal.reaccept`. _(Define también la estrategia para legacy de Task 1.3.)_

### Task 3.4: Checklist pre-registro masivo

| # | Ítem | Owner | Estado |
|---|------|-------|--------|
| 1 | ADR E8 decidido y reflejado en privacidad | Owner | ⚪ Pendiente |
| 2 | Textos v1 revisados por abogado | Legal | ⚪ Pendiente |
| 3 | Signup con aceptación persistida | Dev | 🔴 Task 1.3 |
| 4 | Export/borrado atleta en UI | Dev | ✅ Hecho |
| 5 | Consentimiento ciclo in-app | Dev | 🟠 PR-L2 (sobre base existente) |
| 6 | D1 cifrado ciclo activo en prod (`CYCLE_ENCRYPTION_KEY`) | Ops | ✅ Confirmado en Render (memoria go-live) |
| 7 | Email contacto privacidad operativo | Owner | 🟡 Stopgap `esstipi@gmail.com` |
| 8 | Procedimiento breach → `docs/INCIDENT-RESPONSE.md` | Ops | ✅ Existe |

---

## Criterios de aceptación globales

1. **Transparencia:** cualquier usuario lee privacidad y términos **antes** de crear cuenta y sabe que los datos pueden estar en US. _(Discoverability ✅; texto pendiente.)_
2. **Trazabilidad:** cada cuenta nueva tiene timestamp + versión de documentos aceptados. _(🔴 Task 1.3.)_
3. **Ciclo:** ninguna atleta ve el módulo sin paso explícito de activación; coach nunca recibe `state`/fase/síntoma crudo (tests existentes + nuevos verdes). _(Aislamiento ✅; activación 🟠.)_
4. **Derechos:** atleta exporta JSON y borra cuenta desde la app sin soporte manual. _(✅ Hecho.)_
5. **Dominio:** El Carnicero no marca CRITICAL/HIGH en el diff vs. `HOLY-OLY-DOMAIN.md` §3 y §5.

---

## Riesgos y mitigaciones

| Riesgo | Mitigación |
|--------|------------|
| Texto legal retrasa launch | Ship estructura + `v1-beta` con disclaimer (ya visible); abogado itera sobre markdown en repo |
| Usuarios legacy sin aceptación | Migración one-shot (`createdAt`/`v0-stub`) o modal en login (Task 3.3) |
| Confusión share min/full | Copy con ejemplos **ya implementado** en `CicloSection`; reusar |
| Regresión privacidad ciclo | Tests existentes (`cycle-data.int.test.ts`) + nuevos de activación; el coach nunca recibe `state` crudo |
| Numeración de migración colisiona con booking WIP | Confirmar el n libre (≥19) antes de crear la migración de Task 1.3 / 2.2 |

---

## Estimación (revisada — alcance real)

| Fase | Dev | Nota |
|------|-----|------|
| 0 | — | 1–3 días calendario (owner + abogado) |
| 1 (PR-L1) | **~1 día** | Solo Task 1.3 es código nuevo; export/borrado y footer ya hechos. +fix copy stale |
| 2 (PR-L2) | **~1.5–2 días** | API y UI base ya existen; falta gate de activación + 2 campos schema + consentimiento |
| 3 (PR-L3) | ~1–2 días | Cookies/subprocesadores/re-aceptación |

**Total dev:** ~3.5–5 días (vs. ~6–9 del plan original, porque export/borrado y la API/UI de ciclo ya estaban). **Calendario:** depende de asesoría legal.

---

## Referencias

| Tema | Archivo |
|------|---------|
| Dominio ciclo | `docs/domain/HOLY-OLY-DOMAIN.md` §3 ✅ |
| Región datos | `docs/adr/2026-06-07-data-region.md` ✅ |
| Seguridad D1/D3/D4/E8 | `docs/superpowers/specs/2026-06-07-security-improvement-plan.md` ✅ |
| Páginas legales | `apps/web/src/screens/legal/LegalPages.tsx` |
| Signup | `apps/web/src/auth/AuthScreen.tsx` |
| API ciclo + export/borrado | `apps/api/src/me/routes.ts` |
| UI ciclo | `apps/web/src/screens/atleta/CicloSection.tsx` |
| UI cuenta atleta (export/borrado) | `apps/web/src/screens/atleta/CuentaMin.tsx` |
| Cuenta coach (legal links) | `apps/web/src/screens/coach/macros/CuentaCoach.tsx` |
| Redacción ciclo coach | `apps/api/src/server.ts` (audit `cycle.read`) |
| Schema | `apps/api/prisma/schema.prisma` (`User` §64, `CycleConsent` §340) |
| Incidentes / breach | `docs/INCIDENT-RESPONSE.md` ✅ |
| Handoff launch legal stubs | `docs/superpowers/HANDOFF-2026-06-09-launch-continuation.md` ✅ |

---

## Orden sugerido de implementación (dev) — alcance real

1. **Task 1.3** — campos `User` + checkbox signup + API rechaza sin aceptar + migración legacy _(el gap más limpio y de mayor valor regulatorio)_.
2. **Fix copy stale** en `LegalPages.tsx:45` _(trivial, sin abogado)_.
3. **Task 2.1** spec ciclo → **Task 2.2** schema `consentVersion/consentedAt` + activación en `PUT` → **Task 2.3** gate de activación en `CicloSection`.
4. Texto legal `v1` (Task 1.1/1.2, 2.4) cuando Fase 0 + abogado lo entreguen.
5. Cookies/subprocesadores/re-aceptación (Fase 3) según stack final.
