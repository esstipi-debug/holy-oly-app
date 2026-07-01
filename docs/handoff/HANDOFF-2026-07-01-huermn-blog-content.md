# HANDOFF 2026-07-01 — Plataforma de contenido huermn + Blog Holy Oly (LIVE) + minería de temas

**Para:** continuar en una ventana de contexto nueva.
**Repos:** `C:\Holy Oly 0017` (Holy Oly, este repo) + `C:\volta-atlas\packages\huermn` (ahora repo propio).
**Rama de trabajo en Holy Oly:** `feat/wellness-huberman-authoring` (local, desactualizada — todo lo relevante de esta sesión ya está en `origin/main`). El working tree principal de `C:\Holy Oly 0017` puede tener **WIP de otra sesión paralela sin commitear** — no tocar archivos que no reconozcas sin investigar primero.

---

## 1. Qué es esto (contexto de una línea)

huermn (RAG de ~9.660 fragmentos de transcripts de Huberman Lab, en `C:\volta-atlas\packages\huermn`) se convirtió en un **agente de contenido independiente compartido** por Volta (CrossFit) y Holy Oly (halterofilia). Su salida alimenta un **blog en Astro** que ya está **LIVE en producción**: **https://holy-oly-landing.onrender.com** (`/` = landing porteada, `/blog` = 5 artículos).

Regla de oro que gobierna todo esto (INTOCABLE, ya en `~/.claude/projects/.../memory/huermn-plataforma-contenido.md`): **Huberman nunca se nombra en ninguna superficie pública**; se cita la **ciencia primaria** (estudios peer-reviewed) en su lugar. Un guard regex (`/huberman/i`, `/\brpe\b/i`) bloquea cualquier `ContentDoc` publicado que lo viole, tanto en Python (huermn) como en TS (Holy Oly).

## 2. Estado LIVE ahora mismo (verificado con curl)

- **https://holy-oly-landing.onrender.com/** — landing porteada verbatim del `docs/marketing/landing-coach.html` original (demo interactivo atleta⇄coach, catálogo de 6 macrociclos, formulario de leads real a `POST /leads`).
- **https://holy-oly-landing.onrender.com/blog** — índice con **5 artículos**: luz matinal, cafeína, entorno de sueño, timing de entrenamiento, descanso guiado profundo (Yoga Nidra). Cada uno con cita primaria real y verificada (DOI), split de aplicación CrossFit/Halterofilia, sin nombrar la fuente.
- **Modo oscuro** en `/blog`: botón sol/luna en el header, persistente (`localStorage`), sin flash. Solo el blog — la landing tiene su propio dark theme fijo, sin toggle.
- Servicio Render: `holy-oly-landing` (`srv-d90nqmv7f7vs73cqfmgg`), fuente = `apps/landing/` (Astro) en `main`, build command `pnpm --filter @holy-oly/landing build`, publishPath `apps/landing/dist`. **NO agregar `corepack enable`** al build command (rompe con `EROFS` en ese runtime — el buildpack ya corre `pnpm install` solo).
- API key de Render: `C:\Users\Gamer\Videos\.render-key.txt` (uso: `RENDER_KEY=$(cat "/c/Users/Gamer/Videos/.render-key.txt")`).
- `docs/marketing/landing-coach.html` sigue en el repo (mergeado a main) pero **ya no se usa para el deploy** — es referencia histórica.

## 3. Repo huermn (independiente)

- **https://github.com/esstipi-debug/huermn** (privado), branch `master`.
- Vive en `C:\volta-atlas\packages\huermn`, corre con su propio `.venv` (`Scripts/python.exe`, pytest 9.1.1, chromadb/fastapi/pydantic/yaml todos instalados).
- `content/published/*.yaml` = **corpus fuente única** (5 `ContentDoc` ahora). La consume `apps/landing/scripts/sync-corpus.mjs` en Holy Oly.
- El índice **Chroma ya está poblado**: 9.660 vectores (`ingest.index_chroma.get_collection().count()`). Verificado en esta sesión — antes se creía que había que leer los transcripts crudos a mano; **NO, usar `agent.tools.search_huberman(query, top_k=N)`** para minar temas (barato, rápido, ya indexado).
- Volta consume huermn por HTTP (`VITE_HUERMN_API`), sin acoplar código — el repunte ya se hizo (`d76b3f0` en `claude/athlete-ui`).

## 4. La cifra real de "cuánto contenido hay" (el owner preguntó esto)

No son "9.660 artículos". Son dos cosas distintas:
- **5 cards curadas a mano** (estructura completa) — **las 5 ya están usadas** en los 5 artículos publicados. Se acabó este stock fácil.
- **~9.655 fragmentos de transcript crudo** (`huberman_transcript_<episodio>_<N>.yaml`) de **172 episodios distintos** — es materia prima para minar, no artículos listos.

## 5. Minería de temas — HECHA, resultado sin usar aún

Se corrió un barrido semántico (30 consultas curadas vía `search_huberman`, ver abajo) contra el índice completo. Resultado: **22 temas candidatos** con evidencia real detrás, organizados por categoría. **El owner todavía no eligió cuáles convertir en artículos** — esto es lo próximo a retomar.

### Los 22 candidatos (copiar tal cual al reabrir la conversación con el owner)

**🛌 Recuperación:** exposición al frío (timing respecto al entreno de fuerza) · sauna/calor deliberado (minutos/semana, beneficio CV) · enfriamiento post-esfuerzo (palmas/plantas > cuerpo entero) · respiración para bajar estrés rápido ("suspiro fisiológico", Balban et al. 2023 *Cell Reports Medicine*) · alcohol y sueño/recuperación (fragmenta REM) · manejo del dolor (modulación top-down).

**🏋️ Rendimiento:** testosterona y trabajo pesado · creatina (dosis, ISSN position stand) · proteína y síntesis muscular (leucina, distribución diaria) · resistencia muscular vs. cardiovascular (relevante para MetCons largos) · entrenamiento concurrente fuerza+resistencia (efecto interferencia, muy relevante CrossFit) · grip como marcador de fatiga sistémica.

**🍽️ Nutrición:** ayuno intermitente y rendimiento · hidratación y electrolitos.

**🧠 Mentalidad** (categoría nueva posible): dopamina y motivación sostenida · formación de hábitos (consistencia > horario perfecto) · foco/atención entrenable.

**🤸 Movilidad** (categoría nueva posible): estiramiento estático vs. dinámico · prevención de lesiones (el dolor no siempre está donde está el problema).

**🩸 Específico femenino:** entrenamiento y ciclo menstrual — **refuerza directamente el módulo de ciclo que ya existe en Holy Oly** (alta prioridad de producto); evidencia mixta pero real (Sims et al.), citar con honestidad la incertidumbre.

**Descartado esta pasada** (señal débil, no perseguir todavía): salud intestinal (solo dio ruido de auspiciantes del podcast), deload/periodización (resultados tangenciales), visión y música (interesantes, menor prioridad).

### Cómo se hizo (para repetir con otras 30 queries si hace falta más cobertura)

```python
# En C:\volta-atlas\packages\huermn, con .venv activado:
from agent.tools import search_huberman
hits = search_huberman("cold exposure and recovery", top_k=6)
# cada hit: {"id", "metadata": {"source_title", ...}, "distance", "text"}
```
Se corrieron 30 queries en inglés (el corpus está en inglés) cubriendo sueño/recuperación/nutrición/rendimiento/mentalidad/movilidad/femenino, `top_k=6` cada una → 180 hits → 74 episodios distintos tocados (de 172 totales). El script ad-hoc (`_mine_topics.py` + `_mine_results.json`) se **borró** después de usarlo — no es parte del producto, si hace falta repetir la minería, recrearlo es trivial (ver snippet arriba).

## 6. Pregunta del owner SIN responder — "¿de dónde podés sacar más info de Huberman?"

Esta pregunta quedó **a mitad de investigar** cuando se pidió este handoff. Ya se había leído `data/huberman/sources.yaml` (en huermn), que documenta un plan de ingesta por niveles, **todo en estado `pending`** (nunca ejecutado):

```yaml
tier_1_public_free:   # 4 URLs públicas de hubermanlab.com (toolkit de sueño, daily routines, nsdr, sleep toolkit episode) — status: pending
tier_2_episode_show_notes:  # show notes con timestamps de episodios, por tema — status: pending
tier_3_premium:        # transcripts completos, requiere membresía — status: not_available_unless_user_provides
```

**Falta investigar antes de responder al owner:**
1. Leer `ingest/fetch_premium_transcripts.py` y los scripts en `ingest/debug/` (`debug_supercast_*.py`, `debug_login_*.py`, `debug_sso.py`, `debug_code_login.py`, `debug_episode_page.py`) — parece haber ya un intento de scraping semi-automatizado del dashboard de transcripts premium (`hubermanlab.supercast.com`).
2. Leer `ingest/import_transcripts.py` para entender el pipeline actual raw→chunks.
3. Confirmar cuántos episodios totales tiene Huberman Lab publicados hoy (con WebSearch/WebFetch, ya cargados en esta sesión) vs. los 172 que ya están indexados — probablemente hay episodios nuevos desde que se hizo el ingest original, sin necesidad de premium.
4. Armar la respuesta final con 2-3 opciones concretas (ej.: "más episodios públicos vía YouTube/transcripts de la web sin pagar" vs. "premium con el flujo semi-automatizado que ya existe" vs. "seguir minando lo que ya está indexado, que rinde 22 temas y todavía no se agotó").

**Ojo con el copyright:** `README_PREMIUM.md` en huermn es explícito — los transcripts premium **nunca se commitean** (`.gitignore` ya los cubre); cualquier fuente nueva debe respetar la misma regla.

## 7. Convenciones establecidas esta sesión (aplicar de nuevo)

- **Nunca trabajar directo en `C:\Holy Oly 0017`** si hay cambios sin commitear ajenos en el working tree (patrón recurrente: sesiones paralelas). Usar **worktree aislado** desde `origin/main`:
  ```bash
  git fetch origin main -q
  git worktree add "C:/tmp-holyoly-<algo>" origin/main -B feat/<rama-nueva>
  # trabajar, pnpm install, pnpm -r test, pnpm --filter @holy-oly/landing build
  git push origin feat/<rama-nueva>:main   # si rechaza por "fetch first", git merge origin/main --no-edit y reintentar
  git worktree remove "C:/tmp-holyoly-<algo>" --force && git branch -D feat/<rama-nueva>
  ```
- Tras `pnpm install` en un worktree nuevo, correr `pnpm --filter @holy-oly/api prisma:generate` antes de testear (los build scripts de Prisma vienen bloqueados por default en pnpm).
- Tras pushear a `main`, disparar deploy manual y esperar a `status=live`:
  ```bash
  RENDER_KEY=$(cat "/c/Users/Gamer/Videos/.render-key.txt")
  curl -s -X POST "https://api.render.com/v1/services/srv-d90nqmv7f7vs73cqfmgg/deploys" -H "Authorization: Bearer $RENDER_KEY" -H "Content-Type: application/json" -d '{}'
  # poll GET .../deploys?limit=1 hasta status=live o build_failed
  ```
- Toda cita científica en artículos del blog se **verifica con WebSearch/WebFetch antes de publicar** (nunca inventar DOI/autores/journal) — así se hizo con las 2 últimas (Pradhan et al. 2024 *Chronobiology International*; Datta et al. 2021 *National Medical Journal of India*).
- Preferir el **nombre clínico/genérico** de una técnica sobre la sigla popularizada por la fuente cuando ambos existen (ej.: "Yoga Nidra" en vez de la sigla de NSDR) — pasa el guard igual, pero es más seguro en espíritu.
- `preview_screenshot`/`preview_start` de este entorno son poco confiables para `apps/landing` — usar `astro preview --port <libre> &` vía Bash + Playwright (`browser_navigate`/`browser_take_screenshot`/`browser_evaluate`) en su lugar. El estado del tab de Playwright puede desincronizarse entre llamadas — si el título/URL reportado no coincide con lo esperado, cerrar tabs (`browser_tabs action:close`) y renavegar limpio antes de confiar en el resultado.
- Memoria del proyecto: `~/.claude/projects/C--Holy-Oly-0017/memory/huermn-plataforma-contenido.md` tiene el detalle completo de todo esto (léela al retomar). Índice: `MEMORY.md`, entrada "huermn → agente de contenido independiente + BLOG LIVE".

## 8. Próximos pasos posibles (en orden sugerido, no obligatorio)

1. Responder la pregunta de sourcing (sección 6) — investigar y presentar opciones al owner.
2. Owner elige 2-4 de los 22 candidatos (sección 5) → escribir esos `ContentDoc` en huermn (mismo patrón: parafrasear, cita primaria verificada, `applications` por deporte) → sync → deploy.
3. Considerar si "Mentalidad" y "Movilidad" se vuelven categorías reales navegables (hoy el nav del blog no filtra por categoría, ver más abajo).
4. Pendientes ya anotados de sesiones previas: i18n del blog (diferido a propósito), páginas de filtro por categoría/tag (no existen aún, el nav apunta todo a `/blog`), SP-3 Blog Volta (mismo corpus, marca de Volta), `sport` param en el coach `/ask` en vivo (feature de Volta, diferida).
