# MASTER SPEC — Holy Oly / BECCTTOR: Función de Análisis, App Viva y Motor de Entrenamiento

> **Documento maestro.** Consolida todo lo diseñado en este chat. Es el índice + contexto + orden de implementación para Claude Code. Cada sección referencia su spec detallada (en `/outputs/`). Stack: Node.js + Express, React + Vite, Tailwind v4, Motion (`motion/react`), Phosphor icons, PostgreSQL + Prisma, microservicio Python (FastAPI) para CV, Render, Cloudflare R2. Alineado con `taste-skill`, `ui-ux-pro-max`, `fullstack-developer`.

---

## 0. Mapa de las 5 specs y sus dependencias

```
                    ┌─────────────────────────────────┐
                    │  MASTER SPEC (este documento)    │
                    └─────────────────────────────────┘
                                    │
   ┌────────────────┬──────────────┼──────────────┬─────────────────┐
   ▼                ▼              ▼              ▼                 ▼
[1] Análisis    [2] App Viva   [3] Datos +    [4] Super-       [5] Motor de
    de Video        (grafo de      Fricción +     compensación      Prescripción
    (CV + share)    entidades)     Visualización   + Peaking         (Prilepin→sets)

DEPENDENCIAS (qué necesita qué):
  [2] App Viva es el ESQUELETO. Todo lo demás se renderiza dentro de su grafo.
  [3] Datos/Fricción define qué entra y cómo se ve → alimenta [4] y [5].
  [5] Motor consume el ACWR/sRPE del Stress Engine y produce las prescripciones.
  [4] Peaking usa [5] para generar las semanas; usa [3] para el semáforo.
  [1] Video produce métricas que entran al grafo [2] y a las share cards.

ORDEN DE CONSTRUCCIÓN RECOMENDADO:
  Fase A → [2] esqueleto del grafo + [3] modo atleta núcleo
  Fase B → [5] motor de prescripción + [4] olas continuas
  Fase C → [4] peaking por fecha + [3] visualización completa
  Fase D → [1] análisis de video V0 → V1 + share cards
```

Archivos de referencia:
- `spec-app-viva-interactividad.md` → [2]
- `spec-datos-friccion-visualizacion.md` → [3]
- `spec-supercompensacion-peaking.md` → [4]
- `spec-motor-prescripcion.md` → [5]
- (análisis de video [1] → resumen abajo en §1; spec CV completa en el artifact del chat)

---

## 1. [VIDEO] Análisis de video de halterofilia + monetización + plantillas

### 1.1 Resumen técnico
- **CV stack:** microservicio Python (FastAPI) como Background Worker en Render. **MediaPipe Pose** (V0) → **RTMPose-m** (V1, Apache 2.0) para el cuerpo. **YOLOv8n/v11n fine-tuneado para discos** (datasets Roboflow) + tracker **CSRT** entre detecciones + fallback de marcado manual del disco en frame 1. Suavizado Kalman.
- **Evitar YOLO-pose de Ultralytics** salvo aceptar AGPL-3.0 o licencia comercial.
- **Pipeline:** upload (compresión cliente con ffmpeg.wasm) → R2 → BullMQ+Redis → worker Python → JSON de métricas → FFmpeg overlay → R2 → polling/webhook al frontend.
- **Calibración:** diámetro de disco olímpico (450mm) como referencia px→m. Métricas = consistencia comparativa intra-atleta, NO precisión de laboratorio.
- **Costo Render realista:** ~$45-70/mes (worker Standard 2GB + API + Postgres + Redis).

### 1.2 Métricas extraídas (V1)
Trayectoria de barra (tipo Vorobyev 1/2/3/4), desplazamiento horizontal (dx1, dx2, neto hacia atrás), velocidad por fase (1er tirón, transición, 2º tirón, turnover, catch), altura máxima (% estatura), ángulos articulares en posiciones clave.

### 1.3 Catálogo de 10 errores detectables
Barra alejada en 1er tirón, looping en 2º tirón, salto adelante en recepción, extensión incompleta de cadera, tirón temprano de brazos, recepción alta sin sentadilla, pérdida de contacto barra-cuerpo, descenso lento, cadera sube primero, pérdida de velocidad en transición. Cada uno con condición lógica (umbral calibrable), mensaje al atleta y drill. **Reglas basadas en dirección (cruce de línea de referencia) más que en magnitud absoluta** (los valores se solapan entre lifts buenos y malos).

### 1.4 Capa de contenido compartible
- **V0/V1:** FFmpeg (drawtext + overlay + filter_complex) para bar path + métricas quemadas.
- **V2:** Remotion (React para video) para share cards animadas (PR celebration, resumen de sesión), formato 9:16, watermark Holy Oly como growth loop (precedente Hevy >2M descargas sin paid).

### 1.5 Monetización (decisión del chat)
Planes con cuota de análisis + cobro por excedente:
- **Starter $9.99/mes** → 5 análisis/mes; extra **$0.99**.
- **Coach $24.99/mes** → 25 análisis/mes; extra **$1.99**.
- **Gym $49.99/mes** → ilimitado.
- Cobro **antes** de procesar (Stripe). Quota se resetea mensual. Schema Prisma: `Coach.plan`, `Coach.videoQuotaRemaining`, `VideoAnalysis.chargeAmount`.

### 1.6 Plantillas de grabación (reduce fricción y errores de precisión)
Pantalla de onboarding obligatoria antes del primer upload + validación automática (¿disco visible? ¿luz? ¿fps?). Instrucciones: cámara perpendicular (90°), 3-4m, altura media de barra, trípode fijo, 60fps ideal/30 mínimo, landscape, <100MB. Componente `VideoUploadGuide` + función `validateVideoQuality`.

### 1.7 Roadmap video
- **V0 (~2-3 sem):** bar path overlay (OpenCV) + 2-3 métricas, marcado manual disco, FFmpeg.
- **V1 (~4-6 sem):** pose, fases, 5-6 errores, JSON completo, detección automática YOLO.
- **V2 (~4-6 sem):** share cards Remotion, RTMPose-m si hace falta.

---

## 2. [APP VIVA] El grafo de entidades (el esqueleto de todo)

### 2.1 Principio rector
> Todo sustantivo en pantalla es una entidad clickeable. Todo click responde: "¿cómo se creó esto?" (origen) o "¿cómo lo mejoro?" (progresión). La app es un **grafo navegable**, no una lista de pantallas.

### 2.2 Entidades clickeables
Movimiento, RM/PR, Secuencia/Set, Sesión, Atleta, Drill, Error técnico, Métrica, Semáforo readiness, % de carga. Cada una con "¿de dónde sale?" respondible en un tap.

### 2.3 Tres niveles de navegación (siempre iguales)
- **Nivel 0 — Chip:** mención en línea, semibold + acento sutil, touch target ≥44px.
- **Nivel 1 — Peek:** bottom sheet 40-60%, card estilo FIFA con 3-5 stats + 2 acciones, contexto de fondo visible. Peek-sobre-peek máx 2.
- **Nivel 2 — Página:** navegación completa, breadcrumb máx 3 saltos, swipe-back.

### 2.4 Arquitectura técnica (3 componentes + 1 endpoint)
- `EntityChip` (átomo tonto: type+id → openPeek).
- `PeekSheet` (global, Zustand `peekStack`, registry por tipo).
- `EntityPage` (ruta `/e/:type/:id`).
- `GET /api/entity/:type/:id?depth=peek|full` → contrato uniforme (card, stats, edges, actions). Agregar entidad nueva = resolver backend + Peek component, cero cambios en navegación.

### 2.5 Prisma: la edge que conecta RM ◄── secuencia
`SetSequence { sessionId, movementId, sets Json, producedPrId }` + `PerformanceRecord.sequenceId`. Es lo que hace posible el Flujo A (RM → la secuencia 3x3 que lo creó).

### 2.6 Lenguaje FIFA
Tomar: card como identidad (número héroe + sub-stats), tiers ganados (del skill tree DAG), radar de atributos. NO tomar: brillo permanente (el 🔥 del PR es evento de 1.5s). "Más dinámico" = continuidad espacial con `layoutId` de Motion (chip→peek→página es el mismo objeto en 3 escalas).

---

## 3. [DATOS] Fricción, dos modos y visualización

### 3.1 Principio anti-fricción
> Cada dato que pides se paga con una devolución visible, o no lo pides. El dato entra por entrenar, no por formularios.

### 3.2 Dos modos (decisión del chat)
- **Modo Atleta (default, fricción casi nula):** sets×reps×peso (ya los registra) → tonelaje, Prilepin, conteo ≥90%, PRs. + Video que ya sube → velocidad y bar path gratis. + **Una** pregunta de readiness (3 caras). **80% del valor sale de aquí.**
- **Modo Lab (opt-in):** CMJ (potencia concéntrica + altura media, no solo máx), sueño detallado, HRV, perfil carga-velocidad, pérdida de velocidad. Cada métrica con **badge de evidencia**.

### 3.3 La pregunta única de readiness
Al abrir: "¿Cómo te sientes?" 🟢🟡🔴 + omitir siempre. Tras el tap → el semáforo se pinta y **explica el ajuste** ("bajé el C&J de 85→78% y quité un set"). Combina cara + sueño + sRPE_7d para el color. Auditable por chips (Flujo C).

### 3.4 Data network effect (sin pedir más datos)
Perfil carga-velocidad individual (mejora estimación 1RM), líneas base personales (~10% de caída = bandera), correlación sueño→velocidad. Indicador de "madurez de datos" comunica honestamente cuándo aún aprende.

### 3.5 Visualización — reglas firmes
1. **Un gráfico protagonista por vista, máximo.** Recharts.
2. **Emoji = emoción/celebración (contenido), NUNCA función (UI).** Iconos de interfaz = Phosphor. El 🔥 solo en celebración de PR y share cards. Semáforo = círculo de color sólido + texto, no emoji.
3. Gráficos comunican forma; números exactos viven en los peeks.
4. Todo punto de dato es clickeable.
5. Count-up + dibujado progresivo; `prefers-reduced-motion` respetado.
6. Color con presupuesto: fondo neutro + un acento + semáforo reservado.

Componentes: Sparkline, scatter velocidad-vs-carga (puntos clickeables), radar de atleta (vértices clickeables, sin números en ejes), barra de zonas Prilepin, indicador de madurez de datos, tarjeta de PR con celebración.

### 3.6 Badge de confianza de evidencia
● Sólida (meta-análisis): velocidad de barra, feedback visual, sueño, autorregulación. ◐ Moderada: CMJ concéntrico, pérdida de velocidad, cuestionario subjetivo. ○ Exploratoria (sin validar en halterófilos): grip test, CNS tap test, HRV como predictor, ACWR. Cada peek cita la fuente en una línea.

---

## 4. [PEAKING] Supercompensación, competencia y olas continuas

### 4.1 Pedagogía de supercompensación (sostiene disciplina)
4 fases en lenguaje de atleta: estímulo → fatiga (más débil) → recuperación (el cuerpo se prepara) → supercompensación (por encima de la base). Gancho: **"No te vuelves fuerte en el gimnasio. Te vuelves fuerte recuperándote de él."** Cada descarga/ajuste se explica con supercompensación, no como castigo. Honestidad: es modelo pedagógico, no ley física precisa; las decisiones reales las toma el motor con datos.

### 4.2 Con fecha de competencia → peaking híbrido (decisión del chat)
Plantilla base de taper (escuela elegida) × ajuste por carga real reciente (ACWR 3 sem). Coloca el pico el día de competencia. **Baja volumen, mantiene intensidad alta** ("menos trabajo, mismo peso"). Timeline countdown estilo FIFA.

### 4.3 Sin competencia → olas continuas (decisión del chat)
Olas de 4-6 semanas: acumular → intensificar → mini-pico (single/test opcional → chance de PR) → descarga → repetir. Nunca lejos de la forma; si aparece competencia, la ola se convierte en peaking sin reiniciar. Modulado por readiness.

### 4.4 Competencia con 3 semanas → reorganización (tu pregunta explícita)
Convierte la ola actual en peaking comprimido (intensificación → pico → semana de compe) sin reiniciar. Ajuste híbrido por ACWR. **Honestidad de techo:** si llega fatigado, prioriza frescura sobre kilos y lo dice; promete expresión de fuerza ya construida, no fuerza nueva.

---

## 5. [MOTOR] Prescripción Prilepin → sets×reps×% (decisión C del chat)

### 5.1 Contrato
`generateWeek(input) → WeekPrescription`. Entrada: `weeksToComp`, `currentE1RM`, `recentACWR`, `movement`, `waveWeek?`, `readiness?`. Salida: `sets[]` (sets×reps×%×kg) + `prilepinAudit` + `rationale`.

### 5.2 Las dos perillas que se mueven en oposición
`PHASE_PROFILE` por fase: `taperFactor` baja (1.00 acumulación → 0.25 semana de compe) = volumen↓. `topPct` sube (85% → 100%) = intensidad↑. **Eso es el "menos trabajo, mismo peso" hecho número.**

### 5.3 `phasePlan(weeksToComp)` — qué hacemos según las semanas que quedan
```
≥8 sem: [acumular × (n-4), intensif, pico, taper, semana-compe]
6 sem:  [acumular, acumular, intensif, pico, taper, semana-compe]
5 sem:  [acumular, intensif, pico, taper, semana-compe]
4 sem:  [intensif, pico, taper, semana-compe]
3 sem:  [intensif, pico, semana-compe]   ← tu caso
2 sem:  [pico, semana-compe]
1 sem:  [taper]
```

### 5.4 Los 4 pasos de `generateWeek`
1. Determinar fase (peaking o `wavePhase` si ola).
2. Ajuste híbrido por ACWR (>1.3 → ×0.9; <0.9 → ×1.1).
3. Ajuste por readiness (🟡 ×0.9; 🔴 ×0.75 + mueve singles pesados).
4. Calcular reps por zona desde Prilepin × taper × zoneMix → sets×reps×%, peso redondeado a disco cargable.

### 5.5 Conexiones
`prilepinAudit` → peek de la app viva ("¿por qué esta semana?"). Salida sets×reps×% legible (Prilepin oculto = fricción baja). `rationale` usa microcopy de supercompensación. Readiness entra como multiplicador.

### 5.6 Pendientes marcados
- `roundToLoadable` → enchufar al algoritmo real de redondeo por pares de discos (de los 21 templates).
- `taperFactor` y `zoneMix` → calibrar con datos de coaches piloto (están como config pura testeable).

---

## 6. Modelo de datos consolidado (Prisma)

```prisma
// — App viva (grafo) —
model SetSequence {
  id           String   @id @default(cuid())
  sessionId    String
  movementId   String
  sets         Json     // [{order, reps, weightKg, rpe?, meanVelocity?, videoAnalysisId?}]
  producedPrId String?  @unique
  createdAt    DateTime @default(now())
}
// PerformanceRecord (Arsenal existente) += sequenceId String?

// — Monetización de video —
enum SubscriptionPlan { STARTER COACH GYM FREE_TRIAL }
model Coach {
  id                  String  @id @default(cuid())
  userId              String  @unique
  plan                SubscriptionPlan @default(FREE_TRIAL)
  videoQuotaRemaining Int
  videoQuotaResetAt   DateTime
}
model VideoAnalysis {
  id           String  @id @default(cuid())
  coachId      String
  athleteId    String
  videoUrl     String
  status       String   // pending|processing|completed|failed
  metrics      Json
  chargeAmount Float?
  createdAt    DateTime @default(now())
  coach        Coach    @relation(fields: [coachId], references: [id])
}

// — Readiness / fricción —
model ReadinessLog {
  id         String   @id @default(cuid())
  athleteId  String
  date       DateTime
  feeling    String?  // green|amber|red (de la pregunta única)
  sleepHours Float?
  computed   String   // color final tras combinar con sRPE
  createdAt  DateTime @default(now())
}

// — Peaking / competencia —
model Competition {
  id         String   @id @default(cuid())
  athleteId  String
  date       DateTime
  name       String?
  school     String?  // plantilla de taper elegida
  createdAt  DateTime @default(now())
}
```

---

## 7. Roadmap maestro (orden de implementación end-to-end)

| Fase | Specs | Alcance | Esfuerzo |
|---|---|---|---|
| **A — Esqueleto + datos núcleo** | [2]+[3] | `EntityChip`/`PeekSheet`/`EntityPage` + `/api/entity` (3 tipos) + `SetSequence` + pregunta de readiness + semáforo. Flujo A (RM→secuencia). | ~2.5-3 sem |
| **B — Motor + olas** | [5]+[4] | `generateWeek` (Prilepin→sets) + olas continuas sobre Stress Engine + pedagogía de supercompensación. | ~2.5-3 sem |
| **C — Peaking + visualización** | [4]+[3] | Input de competencia + taper híbrido + `phasePlan` + timeline countdown + componentes Recharts (sparkline, scatter, radar, zonas, PR card). | ~3 sem |
| **D — Video + share** | [1] | V0 bar path → V1 pose+errores+JSON → monetización Stripe + plantillas de grabación → V2 share cards Remotion. | ~10-15 sem |

### Criterios de aceptación globales
- [ ] El grafo: 100% de movimientos/%/RM/métricas son chips que abren peek <150ms.
- [ ] Modo Atleta funciona con máximo 1 tap extra por sesión; omitir nunca bloquea.
- [ ] `phasePlan(3)` → intensif/pico/semana-compe sin reiniciar el programa.
- [ ] Taper baja volumen manteniendo intensidad alta (verificable en prescripción).
- [ ] Cero emojis como iconos de UI; 🔥 solo en celebración y share cards.
- [ ] Un gráfico protagonista por vista; todos los puntos clickeables.
- [ ] Cada métrica de Modo Lab muestra badge de evidencia + fuente.
- [ ] Análisis de video V0: snatch 5-8s → MP4 con bar path + 3 métricas en <60s.
- [ ] `prefers-reduced-motion` respetado en toda animación.

### Decisiones abiertas (pendientes de Stipi)
1. Indicador de madurez de datos: ¿visible siempre o solo primeras ~5 sesiones?
2. Mini-pico de la ola (semana 5): ¿test obligatorio o single opcional con empujón?
3. `taperFactor`/`zoneMix`: calibrar con coaches piloto antes de fijar.

---

## 8. Pantallas nuevas a crear
Ver documento aparte: **`spec-pantallas-claude-design.md`** — lista de pantallas para Claude Design con instrucciones de construcción y puntos de conexión al grafo.
