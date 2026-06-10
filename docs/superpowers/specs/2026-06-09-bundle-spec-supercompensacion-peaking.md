# Spec: Supercompensación, Peaking y Motor de Competencia

> Entregable para Claude Code. Define (1) cómo EXPLICAR la supercompensación al atleta para sostener disciplina, (2) el motor de taper por fecha de competencia (modo **híbrido**), (3) el comportamiento sin competencia (modo **olas continuas**), y (4) la reorganización automática cuando se agrega una competencia con poco margen. Se construye sobre el Stress Engine, ACWR/sRPE y zonas Prilepin ya existentes — NO es un sistema nuevo. Alineado con `spec-app-viva-interactividad.md` y `spec-datos-friccion-visualizacion.md`.

**Design Read:** *Producto deportivo intermedio-avanzado, "FIFA + dark tech", pedagógico sin ser condescendiente.*

---

## 1. Cómo explicar la supercompensación (para sostener disciplina)

### 1.1 El problema de comunicación
El atleta intermedio-avanzado abandona la disciplina por dos creencias erróneas:
- **"Más es mejor"** → entrena fatigado, no supercompensa nunca, se estanca o se lesiona.
- **"El descanso es perder el tiempo"** → salta descargas, no duerme, y mata la fase donde realmente se vuelve más fuerte.

La supercompensación es el concepto que corrige ambas. Pero explicada como gráfico de fisiología aburre. Hay que **anclarla a lo que el atleta ya ve en la app**.

### 1.2 El modelo de las 4 fases (lenguaje del atleta, no del libro)

```
Rendimiento
    │              ╱╲  ← 4. SUPERCOMPENSACIÓN
    │             ╱  ╲    (más fuerte que antes)
────┼────────────╱────╲──────── línea base
    │      ╲    ╱
    │       ╲  ╱  ← 3. RECUPERACIÓN
    │        ╲╱     (el cuerpo reconstruye)
    │     2. FATIGA
    │     (entrenas, bajas)
    │  1. ESTÍMULO
    └─────────────────────────── tiempo
```

Texto exacto para la app (microcopy):
1. **Entrenas (estímulo):** rompes el músculo y agotas el sistema nervioso. Por eso un C&J pesado te deja vacío.
2. **Bajas (fatiga):** justo después estás *más débil* que antes. Normal. Si mides velocidad de barra, la verás caer aquí.
3. **Te recuperas (descanso + sueño):** el cuerpo no solo se repara, se **prepara para la próxima**. Aquí es donde realmente te vuelves fuerte — durmiendo, no entrenando.
4. **Supercompensas:** vuelves por encima de tu línea base. **Si entrenas duro justo aquí, subes. Si entrenas duro en la fase 2, te entierras.**

> El gancho de disciplina: **"No te vuelves fuerte en el gimnasio. Te vuelves fuerte recuperándote de él."** Esto reencuadra el descanso de "pereza" a "la mitad del trabajo".

### 1.3 Por qué esto sostiene la disciplina (conexión con datos)
La supercompensación deja de ser teoría cuando el atleta la **ve en su propia data**:
- El semáforo 🔴 de readiness (spec de fricción) = "estás en fase 2, no es momento de PR".
- La velocidad de barra cae tras una sesión dura y se recupera con sueño = la curva, en vivo.
- El indicador de madurez de datos aprende **el tiempo de recuperación individual** del atleta (unos supercompensan en 48h, otros en 96h) → la app personaliza cuándo programar el siguiente pico.

**Regla de producto:** cada vez que el sistema impone una descarga o baja la intensidad, lo explica en términos de supercompensación, no como castigo. *"Bajé el volumen 30% esta semana. Estás en recuperación — aquí es donde se construye la fuerza para tu pico."*

### 1.4 La trampa a evitar (honestidad de evidencia)
La supercompensación es un **modelo pedagógico útil**, no una ley física precisa. La realidad (modelo de fitness-fatiga de Banister) es más matemática y los tiempos varían mucho entre atletas. La app usa la curva para **enseñar y motivar**, pero las decisiones reales las toma el Stress Engine con datos (ACWR, sRPE, readiness, velocidad). No prometemos al atleta "supercompensarás exactamente el día 3". Decimos: "tu cuerpo necesita recuperarse para subir, y yo aprendo tu ritmo".

---

## 2. ¿La fecha de competencia funciona? Sí — es el ancla del peaking

**Sí, la fecha de competencia funciona y es el input más valioso que el atleta puede dar.** Es la única fecha que justifica orquestar fatiga y supercompensación con precisión: quieres que el pico de la fase 4 caiga **el día de la competencia**, no antes ni después.

Qué hace el sistema con la fecha (decisión: **híbrido** — plantilla base ajustada por la carga real reciente):

1. **Cuenta atrás** desde hoy hasta la fecha → define cuántas semanas hay para el peaking.
2. **Toma una plantilla base de taper** (la que el coach elija, ej. soviética o china).
3. **La ajusta a la carga real del atleta** de las últimas 2-3 semanas (de los sets ya registrados): si venía con volumen muy alto, la descarga es más pronunciada; si venía moderado, menos.
4. **Coloca el pico** para que la supercompensación caiga el día de competencia.

### 2.1 El taper híbrido (la fórmula)
La evidencia de tapering (Bosquet et al., meta-análisis) converge en: **reducir volumen 41-60%, mantener intensidad alta, mantener o reducir levemente la frecuencia, duración 8-14 días.** El sistema híbrido parte de ahí y lo modula:

```
volumen_taper = volumen_base × factor_plantilla × ajuste_carga_reciente

donde:
  factor_plantilla   = 0.40–0.60 según escuela elegida
  ajuste_carga_reciente:
     si ACWR_3sem > 1.3 (venía cargado)  → factor más agresivo (×0.9)
     si ACWR_3sem < 0.9 (venía liviano)  → factor más suave  (×1.1)
  intensidad         = se MANTIENE alta (90-100% en singles, bajando reps)
```

> La intensidad NO baja en el taper — eso es clave y contraintuitivo para el atleta. Se baja el **volumen** (menos reps, menos series), se mantiene el **peso relativo alto**. Esto preserva la adaptación neural mientras disipa la fatiga. La app lo explica: *"Menos trabajo, mismo peso. Quitamos cansancio sin perder fuerza."*

### 2.2 Visualización del peaking (cómo se ve)
Una sola línea de tiempo horizontal hasta la competencia, estilo "countdown FIFA":

```
HOY ──────────────────────────────────────► 🏆 COMPETENCIA
     Acumulación    Intensificación   Taper    (en 21 días)
     ▓▓▓▓▓▓▓▓░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░
     volumen alto → intensidad sube → descarga
```

Cada bloque es un chip clickeable (grafo de la app viva) → explica qué hace y por qué. El día de competencia es un nodo destacado con cuenta regresiva.

---

## 3. Sin competencia: olas continuas (mini-picos cada 4-6 semanas)

**Decisión: olas continuas.** Sin fecha, el motor no se queda plano ni espera input manual — corre **olas de 4-6 semanas** que suben volumen, lo intensifican, y rematan con un mini-pico/descarga, luego reinician. Esto mantiene al atleta en forma y "siempre razonablemente listo", aprovechando la supercompensación en ciclos cortos repetidos.

### 3.1 La estructura de la ola
```
Semana:  1        2        3        4        5        6
         Acumular Acumular Intensif Intensif Mini-pico Descarga
Volumen: ▓▓▓▓     ▓▓▓▓▓    ▓▓▓      ▓▓       ▓         ▓▓
Intens:  media    media    alta     alta     muy alta  baja
                                              ↑
                                         test/single opcional
```

- **Semanas 1-2 (acumulación):** volumen alto, intensidad media. Construye base. (Fase 1-2 de supercompensación a escala de semanas.)
- **Semanas 3-4 (intensificación):** baja volumen, sube intensidad. Convierte base en fuerza.
- **Semana 5 (mini-pico):** intensidad muy alta, volumen mínimo. Oportunidad de **single/test opcional** → potencial PR → dispara la celebración y share card.
- **Semana 6 (descarga):** baja todo. Recuperación real. Reinicia la ola más fuerte.

### 3.2 Por qué olas y no mantenimiento plano
- Mantiene la **motivación**: cada 5-6 semanas hay un mini-pico con chance de PR (gancho de disciplina + contenido viral).
- Aprovecha la supercompensación **repetidamente** en lugar de una sola vez al año.
- Si aparece una competencia a mitad de ola, el sistema **convierte la ola en peaking** sin reempezar (ver §4).
- El atleta nunca está "lejos de su forma" → puede aceptar una competencia con poco aviso.

### 3.3 Ajuste por readiness (cierra con la spec de fricción)
Cada ola se modula con el semáforo: si el atleta acumula 🟡/🔴, el motor extiende la descarga o suaviza la intensificación. La ola es la estructura; la readiness es el ajuste fino diario.

---

## 4. Competencia con 3 semanas: ¿el sistema reorganiza la semana? Sí

**Sí.** Este es el caso crítico y el sistema lo maneja **convirtiendo la ola actual en un peaking comprimido**, sin reiniciar nada. Es exactamente donde el modo híbrido brilla: toma la carga real reciente del atleta y la reorganiza hacia la fecha.

### 4.1 El algoritmo de reorganización (3 semanas)
Al agregar una competencia a 21 días, el sistema:

1. **Lee dónde está el atleta** en su ola continua actual (¿acumulando? ¿intensificando?) y su ACWR de 3 semanas.
2. **Comprime a un peaking de 3 semanas** con esta estructura base (ajustada por carga reciente):

```
            Sem 1 (de 3)        Sem 2 (de 3)        Sem 3 (de 3)
            INTENSIFICACIÓN     PICO                TAPER + COMPE
Volumen:    ▓▓▓▓ (-20% base)    ▓▓ (-45%)           ▓ (-60%) ── 🏆 día 19-21
Intensidad: alta (85-92%)       muy alta (90-100%)  singles de apertura
Foco:       últimos kg de fuerza  afinar técnica     disipar fatiga
            volumen útil          a peso de compe    afilar SNC
```

3. **Ajuste híbrido por carga reciente:**
   - Si **venía cargado** (ACWR > 1.3): la semana 1 ya descarga algo de volumen (no puede intensificar sobre fatiga acumulada). Riesgo: poco margen para disipar → el sistema avisa.
   - Si **venía liviano** (ACWR < 0.9): la semana 1 puede empujar más volumen-intensidad antes del taper.
   - Si **venía en mini-pico** de su ola: ya está medio afilado → taper más suave, aprovecha la forma.

4. **Coloca el pico** para que la supercompensación caiga el día 19-21 (día de competencia).

### 4.2 Honestidad cuando 3 semanas es poco
Tres semanas es **suficiente para un peaking, ajustado pero real** (los tapers efectivos duran 1-2 semanas; 3 da margen). Pero el sistema es honesto si las condiciones son malas:

- Si el atleta llega **muy fatigado** (ACWR alto + readiness 🔴 sostenida): la app avisa *"Con 3 semanas y la carga que traes, priorizo llegar fresco sobre ganar kilos. No esperes un PR de fuerza nueva — esperá rendir lo que ya tienes, descansado."*
- Si el atleta llega **fresco y en forma** (de una ola bien llevada): *"Llegas en buen momento. 3 semanas alcanzan para afinar y apuntar a un PR."*

> Regla: el sistema **nunca finge** que comprimió magia. Reorganiza lo posible y comunica el techo realista. Esto sostiene la confianza (y conecta con el badge de evidencia de la spec de datos).

### 4.3 Qué NO hace el sistema
- **No reinicia** el programa desde cero (perdería la base acumulada).
- **No mete volumen nuevo** en las últimas 2 semanas (eso añade fatiga que no se disipa a tiempo).
- **No sube la intensidad por encima de lo ya tolerado** sin readiness verde.
- **No promete** ganancias de fuerza que 3 semanas no dan; promete **expresión** de la fuerza ya construida, sin fatiga.

---

## 5. Cómo se conecta todo (resumen del flujo)

```
¿Hay competencia con fecha?
   │
   ├── SÍ ──► Peaking híbrido hacia la fecha
   │          (plantilla base × ajuste carga real → pico el día de compe)
   │          ├── ≥6 semanas: peaking completo (acumular→intensificar→taper)
   │          └── 3 semanas:  convierte ola actual en peaking comprimido + honestidad de techo
   │
   └── NO ──► Olas continuas 4-6 semanas
              (acumular→intensificar→mini-pico→descarga→repetir)
              └── aparece competencia → la ola se convierte en peaking (§4)

En TODOS los casos:
   • el semáforo de readiness modula el día a día (spec de fricción)
   • cada descarga/ajuste se explica con supercompensación (§1.3)
   • el sistema aprende el tiempo de recuperación individual y personaliza
```

---

## 6. Roadmap de implementación

| Fase | Alcance | Esfuerzo (solo dev + Claude Code) |
|---|---|---|
| **F1 — Olas continuas** | Motor de ola 4-6 sem (acumular/intensificar/mini-pico/descarga) sobre el Stress Engine. Modulación por readiness. | ~1.5 sem |
| **F2 — Pedagogía supercompensación** | Curva interactiva, microcopy de 4 fases, explicación en cada descarga/ajuste. | ~1 sem |
| **F3 — Peaking por fecha** | Input de competencia, taper híbrido (plantilla × ajuste ACWR), timeline countdown, colocación del pico. | ~1.5-2 sem |
| **F4 — Reorganización comprimida** | Algoritmo de 3 semanas, conversión ola→peaking, mensajes de honestidad de techo. | ~1 sem |

### Criterios de aceptación
- [ ] Sin competencia, el motor corre olas de 4-6 semanas indefinidamente, moduladas por readiness.
- [ ] Agregar una fecha de competencia genera un peaking que coloca el pico **el día de la competencia**.
- [ ] Con 3 semanas, el sistema **convierte la ola actual en peaking comprimido** sin reiniciar.
- [ ] El taper **baja volumen pero mantiene intensidad alta** (verificable en la prescripción).
- [ ] El ajuste híbrido usa la carga real (ACWR 3 sem) del atleta, no solo la plantilla.
- [ ] Cada descarga/ajuste se explica en términos de supercompensación, no de castigo.
- [ ] Cuando 3 semanas es poco margen, el sistema comunica el **techo realista** con honestidad.
- [ ] La curva de supercompensación es interactiva y conecta con la data real del atleta.

### Riesgos
| Riesgo | Mitigación |
|---|---|
| Atleta agrega competencia muy tarde (< 1 sem) | El sistema hace solo un mini-taper y avisa que el margen es mínimo |
| Peaking comprimido sobre atleta fatigado | Priorizar frescura sobre kilos + mensaje de techo realista |
| Atleta salta descargas (cree que pierde forma) | Pedagogía de supercompensación: el descanso ES la mitad del trabajo |
| Olas continuas se sienten "sin propósito" | Mini-pico cada 5-6 sem con chance de PR + share card (motivación) |
| Promesas de PR irreales en 3 semanas | El sistema promete expresión de fuerza ya construida, no fuerza nueva |

---

## 7. Resumen para Claude Code (orden de ejecución)
1. Construir el motor de olas continuas (4-6 sem) sobre el Stress Engine, modulado por el semáforo de readiness.
2. Implementar la curva de supercompensación interactiva + microcopy de las 4 fases, y conectarla a cada decisión de descarga/ajuste del motor.
3. Agregar el input de competencia y el taper híbrido (plantilla base × ajuste ACWR 3 sem), con timeline countdown y colocación del pico el día de compe.
4. Implementar la reorganización comprimida de 3 semanas (ola→peaking sin reinicio) con los mensajes de honestidad de techo según la carga real del atleta.
5. Verificar en todos los casos que el taper baje volumen manteniendo intensidad alta, y que cada ajuste se explique pedagógicamente.
