# SP-0 — huermn como agente de contenido independiente · Plan de implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Sacar huermn a su propio repo como agente compartido, generalizar su contenido a multi-deporte, y definir el contrato `ContentDoc` (offline-now / service-ready) que Volta y Holy Oly consumen.

**Architecture:** huermn se extrae con historia a un repo propio. Su capa de contenido se vuelve sport-agnostic (`applications` por deporte). Un módulo `content/` nuevo define el `ContentDoc` + el guard de publicación (strip `_provenance`, no-name). Un `holy_oly_bridge.py` espeja `volta_bridge.py`. Holy Oly suma un guard de contrato en TS (única pieza ejecutable en esta sesión).

**Tech Stack:** Python 3.11+ (pydantic v2, pyyaml, chromadb, fastapi, pytest) en el repo de huermn · TypeScript + Vitest en `packages/core` de Holy Oly · git subtree para la extracción.

> ⚠️ **Contexto de ejecución (leer antes de empezar):**
> - **T1–T5 corren en el repo de huermn** (hoy en `C:\volta-atlas\packages\huermn`), que **no está montado ni es runnable en esta sesión** (sin venv, faltan `chromadb`/`fastapi`; es WIP con worktrees activos). Para ejecutarlas hay que **sumar `volta-atlas` a la sesión** y coordinar la ventana de extracción con el dueño de Volta.
> - **T6 corre en este repo (Holy Oly)** y es independiente de T1–T5: se puede ejecutar **ya**.
> - Rutas de T1–T5: relativas a la **raíz del repo de huermn** (post-extracción = lo que hoy es `packages/huermn/`).

## Global Constraints

- Huberman **nunca** nombrado en ninguna superficie de producto (regex de guard: `/huberman/i`).
- **RPE nunca** en superficie de atleta (regex de guard: `/\brpe\b/i`).
- Ciencia primaria (`primary_sources`) se cita **solo** en la salida pública.
- Transcripts premium **nunca** commiteados/publicados (ya en `.gitignore`).
- Reglas intocables de Holy Oly intactas: el `core` (macrociclos, discos, % + kg por fila) **no se toca**.
- `_provenance` es metadata de autoría **interna**: presente en borradores, **stripped** en publicados.
- Deportes válidos: `("crossfit", "weightlifting")`.
- Corpus publicada: YAML **snake_case** en `content/published/*.yaml` del repo de huermn (fuente única).

---

## File Structure

**Repo huermn (post-extracción):**
- `content/schema.py` — *(crear)* `ContentDoc` (pydantic) + `build_draft(card, sport)` + `publish(doc)` + `validate_published(data)`.
- `content/loader.py` — *(crear)* `load_published(dir?)` lee la corpus.
- `content/published/luz-matinal-y-rendimiento.yaml` — *(crear)* `ContentDoc` de ejemplo publicado.
- `content/__init__.py` — *(crear)* paquete.
- `ingest/load_cards.py` — *(modificar)* `card_to_document` lee `applications` (compat con `crossfit_application`).
- `engine/holy_oly_bridge.py` — *(crear)* espejo de `volta_bridge.py` para Holy Oly.
- `tests/test_load_cards.py`, `tests/test_content_schema.py`, `tests/test_content_corpus.py`, `tests/test_holy_oly_bridge.py` — *(crear)*.
- `requirements.txt`, `pyproject.toml` — *(crear si no existen)* para que el repo corra solo.

**Repo Holy Oly:**
- `packages/core/src/data/contentDoc.ts` — *(crear)* interfaz wire `ContentDoc` + `validatePublishedContentDoc`.
- `packages/core/src/data/contentDoc.contract.test.ts` — *(crear)* test de contrato del lado consumidor.

---

### Task 1: Extraer huermn a su propio repo (con historia)

> **Tarea de operaciones/coordinación, no TDD.** Gate: acordar ventana con el dueño de Volta; cerrar/parkear los worktrees en `.claude/worktrees/` antes de empezar. El criterio de aceptación es "los tests de huermn pasan en el repo nuevo".

**Files:**
- Create: `requirements.txt`, `pyproject.toml` (en el repo nuevo, si no existen)

**Interfaces:**
- Produces: un repo `huermn` independiente cuya raíz es el contenido actual de `packages/huermn/`; todos los imports (`from agent.coach import …`, `from ingest.index_chroma import …`) siguen resolviendo desde la raíz.

- [ ] **Step 1: Confirmar que los worktrees activos no entran en la extracción**

Run (en `C:\volta-atlas`): `git worktree list`
Acción: cerrar/mergear los worktrees bajo `packages/huermn/.claude/worktrees/`. Verificar que `.claude/` esté en `.gitignore` del subtree (si no, agregarlo antes del split para no arrastrar worktrees).

- [ ] **Step 2: Verificar que los binarios pesados de Chroma están manejados**

Run: `git ls-files packages/huermn/data/huberman/chroma | head`
Expected: si aparecen los `.bin`, decidir conscientemente (commitearlos al repo nuevo o regenerarlos con `python -m ingest.index_chroma`). Los `raw/transcripts/*.txt` premium **deben** seguir ignorados.

- [ ] **Step 3: Split de la historia de huermn a una rama**

```bash
cd /c/volta-atlas
git subtree split --prefix=packages/huermn -b huermn-export
```
Expected: crea la rama `huermn-export` con solo la historia de `packages/huermn`.

- [ ] **Step 4: Crear el repo nuevo y empujar la rama**

```bash
# Crear repo vacío 'huermn' en el remoto (gh repo create huermn --private), luego:
cd /c
git clone <url-del-repo-huermn-vacio> huermn
cd huermn
git pull /c/volta-atlas huermn-export
git push origin HEAD:main
```

- [ ] **Step 5: Hacer el repo auto-suficiente (deps + packaging)**

Create `requirements.txt`:
```
chromadb>=0.5
fastapi>=0.110
uvicorn>=0.29
pydantic>=2.6
pyyaml>=6.0
pytest>=8.0
```
Create `pyproject.toml`:
```toml
[build-system]
requires = ["setuptools>=68"]
build-backend = "setuptools.build_meta"

[project]
name = "huermn"
version = "0.3.0"
requires-python = ">=3.11"

[tool.pytest.ini_options]
pythonpath = ["."]
```
> Pinear versiones a las que Volta ya usaba si difieren.

- [ ] **Step 6: Verificar que los tests pasan en el repo nuevo**

```bash
cd /c/huermn
python -m venv .venv && . .venv/Scripts/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
pytest -q
```
Expected: la suite existente (`tests/test_huberman.py`, `test_parse_wod.py`, `test_volta_bridge.py`, …) pasa.

- [ ] **Step 7: Apuntar Volta al repo nuevo y commit**

En `volta-atlas`: reemplazar `packages/huermn` por la dependencia/servicio externo (submodule o referencia). Commit:
```bash
git commit -m "chore: huermn extraído a repo propio; volta lo consume como dependencia externa"
```

---

### Task 2: `card_to_document` sport-agnostic (capa de contenido)

**Files:**
- Modify: `ingest/load_cards.py:26-51` (`card_to_document`)
- Test: `tests/test_load_cards.py` (crear)

**Interfaces:**
- Consumes: cards dict (de `load_cards`).
- Produces: `card_to_document(card) -> tuple[str, dict, str]` — el texto indexado incluye **todas** las aplicaciones por deporte; `metadata["sports"]` lista los deportes con aplicación.

- [ ] **Step 1: Escribir el test que falla**

```python
# tests/test_load_cards.py
from ingest.load_cards import card_to_document


def test_card_to_document_includes_all_sport_applications():
    card = {
        "id": "x", "topic": "t", "summary": "s",
        "applications": {"crossfit": ["a"], "weightlifting": ["b"]},
    }
    _id, meta, text = card_to_document(card)
    assert "Crossfit application:" in text and "- a" in text
    assert "Weightlifting application:" in text and "- b" in text
    assert set(meta["sports"].split(",")) == {"crossfit", "weightlifting"}


def test_card_to_document_backward_compat_crossfit_application():
    card = {"id": "y", "topic": "t", "summary": "s", "crossfit_application": ["legacy"]}
    _id, meta, text = card_to_document(card)
    assert "Crossfit application:" in text and "- legacy" in text
    assert meta["sports"] == "crossfit"
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `pytest tests/test_load_cards.py -v`
Expected: FAIL (`meta` no tiene `"sports"`; no aparece "Weightlifting application:").

- [ ] **Step 3: Implementar el cambio mínimo**

```python
# ingest/load_cards.py  (reemplaza card_to_document y agrega _applications)
def _applications(card: dict[str, Any]) -> dict[str, list[str]]:
    apps = card.get("applications")
    if isinstance(apps, dict):
        return {k: list(v or []) for k, v in apps.items()}
    legacy = card.get("crossfit_application") or []
    return {"crossfit": list(legacy)} if legacy else {}


def card_to_document(card: dict[str, Any]) -> tuple[str, dict[str, Any], str]:
    """Return (doc_id, metadata, text) for vector indexing."""
    parts = [
        f"Title: {card.get('id')}",
        f"Topic: {card.get('topic')}",
        f"Summary: {card.get('summary', '').strip()}",
    ]
    protocol = card.get("protocol") or []
    if protocol:
        parts.append("Protocol:")
        parts.extend(f"- {p}" for p in protocol)

    apps = _applications(card)
    for sport, lines in apps.items():
        if lines:
            parts.append(f"{sport.capitalize()} application:")
            parts.extend(f"- {p}" for p in lines)

    source = card.get("source") or {}
    metadata = {
        "id": card["id"],
        "topic": card.get("topic", ""),
        "tags": ",".join(card.get("tags") or []),
        "sports": ",".join(apps.keys()),
        "source_type": source.get("type", ""),
        "source_title": source.get("title", ""),
        "source_url": source.get("url", ""),
    }
    return card["id"], metadata, "\n".join(parts)
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `pytest tests/test_load_cards.py -v`
Expected: PASS. Correr también `pytest tests/test_huberman.py -q` (no regresión).

- [ ] **Step 5: Commit**

```bash
git add ingest/load_cards.py tests/test_load_cards.py
git commit -m "feat(content): card_to_document indexa aplicaciones por deporte (compat crossfit_application)"
```

---

### Task 3: Contrato `ContentDoc` + guard de publicación

**Files:**
- Create: `content/__init__.py` (vacío), `content/schema.py`
- Test: `tests/test_content_schema.py`

**Interfaces:**
- Produces:
  - `ContentDoc` (pydantic) con campo `provenance` alias `_provenance`.
  - `build_draft(card: dict, *, sport: str) -> ContentDoc` — borrador con `_provenance` + la `application` del deporte; `body`/`primary_sources` vacíos (parafraseo manual).
  - `publish(doc: ContentDoc) -> dict` — dict sin `_provenance`.
  - `validate_published(data: dict) -> list[str]` — violaciones; `[]` = OK.
  - `SPORTS = ("crossfit", "weightlifting")`.

- [ ] **Step 1: Escribir el test que falla**

```python
# tests/test_content_schema.py
import pytest
from content.schema import build_draft, publish, validate_published


def _card():
    return {
        "id": "sleep_x", "topic": "circadian", "summary": "View light",
        "applications": {"crossfit": ["c"], "weightlifting": ["w"]},
        "source": {"type": "newsletter", "url": "http://x"},
    }


def test_build_draft_carries_provenance_and_only_requested_sport():
    doc = build_draft(_card(), sport="weightlifting")
    assert doc.provenance["huermn_card"] == "sleep_x"
    assert doc.applications == {"weightlifting": ["w"]}
    assert doc.slug == "sleep-x"


def test_build_draft_rejects_unknown_sport():
    with pytest.raises(ValueError):
        build_draft(_card(), sport="football")


def test_publish_strips_provenance():
    out = publish(build_draft(_card(), sport="crossfit"))
    assert "_provenance" not in out and "provenance" not in out


def test_validate_published_flags_provenance_source_and_rpe():
    bad = {"title": "From Huberman", "summary": "keep RPE 8", "body": "x", "_provenance": {}}
    errs = validate_published(bad)
    assert any("provenance" in e for e in errs)
    assert any("huberman" in e for e in errs)
    assert any("rpe" in e for e in errs)


def test_validate_published_passes_clean_doc():
    doc = build_draft(_card(), sport="crossfit")
    doc.title = "Luz matinal"
    doc.body = "La evidencia sugiere exponerse a luz natural temprano."
    assert validate_published(publish(doc)) == []
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `pytest tests/test_content_schema.py -v`
Expected: FAIL (`ModuleNotFoundError: content.schema`).

- [ ] **Step 3: Implementar el módulo**

```python
# content/schema.py
from __future__ import annotations

import re
from typing import Any

from pydantic import BaseModel, Field

SPORTS = ("crossfit", "weightlifting")
_BANNED = (re.compile(r"huberman", re.IGNORECASE), re.compile(r"\brpe\b", re.IGNORECASE))


class PrimarySource(BaseModel):
    title: str
    authors: str | None = None
    journal: str | None = None
    year: int | None = None
    doi: str | None = None


class ContentDoc(BaseModel):
    id: str
    slug: str
    lang: str = "es"
    title: str
    summary: str = ""
    topic: str = ""
    tags: list[str] = Field(default_factory=list)
    states: list[str] = Field(default_factory=list)
    items: list[str] = Field(default_factory=list)
    body: str = ""
    primary_sources: list[PrimarySource] = Field(default_factory=list)
    applications: dict[str, list[str]] = Field(default_factory=dict)
    contraindications: list[str] = Field(default_factory=list)
    provenance: dict[str, Any] | None = Field(default=None, alias="_provenance")

    model_config = {"populate_by_name": True}


def build_draft(card: dict[str, Any], *, sport: str) -> ContentDoc:
    if sport not in SPORTS:
        raise ValueError(f"unknown sport: {sport}")
    apps = card.get("applications")
    if not isinstance(apps, dict):
        legacy = card.get("crossfit_application") or []
        apps = {"crossfit": list(legacy)} if legacy else {}
    source = card.get("source") or {}
    sport_lines = list(apps.get(sport, []))
    return ContentDoc(
        id=card["id"],
        slug=card["id"].replace("_", "-"),
        title=card.get("id", ""),
        summary=(card.get("summary") or "").strip(),
        topic=card.get("topic", ""),
        tags=list(card.get("tags") or []),
        applications={sport: sport_lines} if sport_lines else {},
        contraindications=list(card.get("contraindications") or []),
        provenance={
            "huermn_card": card["id"],
            "source_type": source.get("type"),
            "source_title": source.get("title"),
            "source_url": source.get("url"),
        },
    )


def publish(doc: ContentDoc) -> dict[str, Any]:
    data = doc.model_dump(by_alias=True, exclude_none=True)
    data.pop("_provenance", None)
    data.pop("provenance", None)
    return data


def validate_published(data: dict[str, Any]) -> list[str]:
    errors: list[str] = []
    if "_provenance" in data or "provenance" in data:
        errors.append("published doc must not contain provenance")
    haystack = [str(data.get(k, "")) for k in ("title", "summary", "body")]
    for src in data.get("primary_sources") or []:
        haystack.append(" ".join(str(v) for v in (src.values() if isinstance(src, dict) else [])))
    for lines in (data.get("applications") or {}).values():
        haystack.extend(str(x) for x in lines)
    text = " ".join(haystack)
    for pat in _BANNED:
        if pat.search(text):
            errors.append(f"published doc matches banned pattern /{pat.pattern}/")
    return errors
```

Create `content/__init__.py` (vacío).

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `pytest tests/test_content_schema.py -v`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add content/__init__.py content/schema.py tests/test_content_schema.py
git commit -m "feat(content): ContentDoc + build_draft/publish/validate_published (guard no-name + strip provenance)"
```

---

### Task 4: Corpus publicada + doc de ejemplo validado

**Files:**
- Create: `content/loader.py`, `content/published/luz-matinal-y-rendimiento.yaml`
- Test: `tests/test_content_corpus.py`

**Interfaces:**
- Consumes: `ContentDoc`, `publish`, `validate_published` (Task 3).
- Produces: `load_published(published_dir: Path | None = None) -> list[dict]` — cada dict incluye `_file`.

- [ ] **Step 1: Escribir el test que falla**

```python
# tests/test_content_corpus.py
from content.loader import load_published
from content.schema import ContentDoc, publish, validate_published


def test_all_published_docs_parse_and_pass_guard():
    docs = load_published()
    assert docs, "expected at least one published ContentDoc"
    for raw in docs:
        clean = {k: v for k, v in raw.items() if k != "_file"}
        doc = ContentDoc(**clean)                      # parsea contra el schema
        errs = validate_published(publish(doc))
        assert errs == [], f"{clean.get('slug')}: {errs}"
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `pytest tests/test_content_corpus.py -v`
Expected: FAIL (`ModuleNotFoundError: content.loader`).

- [ ] **Step 3: Implementar el loader y el doc de ejemplo**

```python
# content/loader.py
from __future__ import annotations

from pathlib import Path
from typing import Any

import yaml

PUBLISHED_DIR = Path(__file__).resolve().parent / "published"


def load_published(published_dir: Path | None = None) -> list[dict[str, Any]]:
    root = published_dir or PUBLISHED_DIR
    docs: list[dict[str, Any]] = []
    for path in sorted(root.glob("*.yaml")):
        with path.open(encoding="utf-8") as f:
            data = yaml.safe_load(f)
        if data:
            data["_file"] = path.name
            docs.append(data)
    return docs
```

```yaml
# content/published/luz-matinal-y-rendimiento.yaml
id: sleep-morning-light
slug: luz-matinal-y-rendimiento
lang: es
title: Luz matinal y rendimiento
summary: Exponerse a luz natural temprano ordena el reloj biológico y mejora energía y descanso.
topic: circadian_rhythm
tags: [sueño, recuperación, energía]
states: [warn, alert]
items: [sueno]
body: |
  Ver luz natural dentro de los 30–60 minutos de despertarte ayuda a ordenar el reloj
  biológico: mejora la energía durante el día y la calidad del sueño esa noche. En días
  despejados alcanzan ~10 minutos; con cielo nublado, más tiempo.
primary_sources:
  - title: Light as a central modulator of circadian rhythms, sleep and affect
    authors: Bedrosian TA, Nelson RJ
    journal: Nature Reviews Neuroscience
    year: 2017
    doi: 10.1038/nrn.2016.171
applications:
  weightlifting:
    - Sostiene energía para entrenamientos de fuerza temprano
    - Tras sesiones nocturnas, priorizar luz matinal al día siguiente
contraindications:
  - Nunca mirar fuentes de brillo doloroso
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `pytest tests/test_content_corpus.py -v`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add content/loader.py content/published/ tests/test_content_corpus.py
git commit -m "feat(content): corpus publicada (fuente única) + ContentDoc de ejemplo validado por el guard"
```

---

### Task 5: `holy_oly_bridge.py` (espejo de `volta_bridge.py`)

**Files:**
- Create: `engine/holy_oly_bridge.py`
- Test: `tests/test_holy_oly_bridge.py`

**Interfaces:**
- Produces:
  - `SPORT = "weightlifting"`
  - `holy_oly_recovery_to_context(*, state, weakest_item=None, question=None) -> dict`
  - `content_query_for(state, weakest_item=None) -> str`

- [ ] **Step 1: Escribir el test que falla**

```python
# tests/test_holy_oly_bridge.py
import pytest
from engine.holy_oly_bridge import (
    SPORT, holy_oly_recovery_to_context, content_query_for,
)


def test_recovery_context_sets_weightlifting_sport():
    ctx = holy_oly_recovery_to_context(state="warn", weakest_item="sueno")
    assert ctx["sport"] == "weightlifting" == SPORT
    assert ctx["recovery"] == {"state": "warn", "weakest_item": "sueno"}


def test_recovery_context_rejects_bad_state():
    with pytest.raises(ValueError):
        holy_oly_recovery_to_context(state="broken")


def test_content_query_includes_topic_for_weakest_item():
    q = content_query_for("warn", "sueno")
    assert "recuperación" in q and "sueño" in q


def test_content_query_alert_without_item_is_nonempty():
    assert content_query_for("alert").strip()
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `pytest tests/test_holy_oly_bridge.py -v`
Expected: FAIL (`ModuleNotFoundError: engine.holy_oly_bridge`).

- [ ] **Step 3: Implementar el bridge**

```python
# engine/holy_oly_bridge.py
"""Bridge Holy Oly (halterofilia) ↔ Huermn content/coach context. Espejo de volta_bridge."""
from __future__ import annotations

from typing import Any

SPORT = "weightlifting"
_VALID_STATES = ("ok", "warn", "alert")
_STATE_BASE = {
    "ok": "mantener rendimiento",
    "warn": "mejorar recuperación",
    "alert": "recuperación profunda descanso",
}
_ITEM_TOPIC = {
    "sueno": "sueño",
    "estres": "estrés",
    "fatiga": "fatiga",
    "dolor": "dolor",
    "humor": "ánimo",
    "motivacion": "motivación",
}


def holy_oly_recovery_to_context(
    *, state: str, weakest_item: str | None = None, question: str | None = None
) -> dict[str, Any]:
    if state not in _VALID_STATES:
        raise ValueError(f"unknown recovery state: {state}")
    return {
        "sport": SPORT,
        "recovery": {"state": state, "weakest_item": weakest_item},
        "question": question or "¿Qué priorizo hoy para recuperar?",
    }


def content_query_for(state: str, weakest_item: str | None = None) -> str:
    if state not in _VALID_STATES:
        raise ValueError(f"unknown recovery state: {state}")
    base = _STATE_BASE[state]
    if weakest_item:
        return f"{base} {_ITEM_TOPIC.get(weakest_item, weakest_item)}"
    return base
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `pytest tests/test_holy_oly_bridge.py -v`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add engine/holy_oly_bridge.py tests/test_holy_oly_bridge.py
git commit -m "feat(bridge): holy_oly_bridge — mapea recuperación HO → contexto huermn (sport=weightlifting)"
```

---

### Task 6: Guard de contrato del lado consumidor (Holy Oly · ejecutable en esta sesión)

> Independiente de T1–T5. Corre en **este repo** con Vitest. Blinda el no-name desde el lado de HO antes de que el blog/in-app consuma `ContentDoc`s. El contrato wire es **snake_case** (igual que el YAML publicado).

**Files:**
- Create: `packages/core/src/data/contentDoc.ts`
- Test: `packages/core/src/data/contentDoc.contract.test.ts`

**Interfaces:**
- Produces:
  - `interface ContentDoc` (wire, snake_case).
  - `validatePublishedContentDoc(raw: unknown): string[]` — violaciones; `[]` = válido.

- [ ] **Step 1: Escribir el test que falla**

```typescript
// packages/core/src/data/contentDoc.contract.test.ts
import { describe, test, expect } from "vitest";
import { validatePublishedContentDoc } from "./contentDoc";

const VALID: Record<string, unknown> = {
  id: "sleep-morning-light",
  slug: "luz-matinal-y-rendimiento",
  lang: "es",
  title: "Luz matinal y rendimiento",
  summary: "Exponerse a luz natural temprano ordena el reloj biológico.",
  topic: "circadian_rhythm",
  tags: ["sueño"],
  states: ["warn"],
  items: ["sueno"],
  body: "Ver luz natural dentro de los 30–60 minutos de despertarte ayuda al reloj biológico.",
  primary_sources: [{ title: "Light as a central modulator", year: 2017, doi: "10.1038/nrn.2016.171" }],
  applications: { weightlifting: ["Sostiene energía para fuerza temprano"] },
  contraindications: [],
};

describe("validatePublishedContentDoc", () => {
  test("doc publicado limpio pasa sin violaciones", () => {
    expect(validatePublishedContentDoc(VALID)).toEqual([]);
  });

  test("rechaza provenance embarcada", () => {
    const errs = validatePublishedContentDoc({ ...VALID, _provenance: { huermn_card: "x" } });
    expect(errs.some((e) => e.includes("provenance"))).toBe(true);
  });

  test("rechaza nombrar la fuente o mencionar RPE (intocables)", () => {
    const named = validatePublishedContentDoc({ ...VALID, body: "Según Huberman, ver luz..." });
    expect(named.some((e) => e.includes("banned"))).toBe(true);
    const rpe = validatePublishedContentDoc({ ...VALID, summary: "mantené RPE 8" });
    expect(rpe.some((e) => e.includes("banned"))).toBe(true);
  });

  test("rechaza campos requeridos faltantes", () => {
    const { body, ...noBody } = VALID;
    expect(validatePublishedContentDoc(noBody).some((e) => e.includes("body"))).toBe(true);
  });
});
```

- [ ] **Step 2: Correr el test y verificar que falla**

Run: `pnpm --filter @holy-oly/core test contentDoc`
Expected: FAIL (no existe `./contentDoc`).

- [ ] **Step 3: Implementar el módulo de contrato**

```typescript
// packages/core/src/data/contentDoc.ts
export interface PrimarySource {
  title: string;
  authors?: string;
  journal?: string;
  year?: number;
  doi?: string;
}

/** Contrato wire (snake_case) — igual que el YAML publicado por huermn. */
export interface ContentDoc {
  id: string;
  slug: string;
  lang: string;
  title: string;
  summary: string;
  topic: string;
  tags: string[];
  states: string[];
  items: string[];
  body: string;
  primary_sources: PrimarySource[];
  applications: Record<string, string[]>;
  contraindications: string[];
}

const BANNED: RegExp[] = [/huberman/i, /\brpe\b/i];
const REQUIRED: ReadonlyArray<keyof ContentDoc> = ["id", "slug", "title", "summary", "body"];

/** Devuelve la lista de violaciones de contrato; arreglo vacío = doc publicado válido. */
export function validatePublishedContentDoc(raw: unknown): string[] {
  const errors: string[] = [];
  if (typeof raw !== "object" || raw === null) return ["not an object"];
  const doc = raw as Record<string, unknown>;

  if ("_provenance" in doc || "provenance" in doc) {
    errors.push("must not contain provenance");
  }
  for (const field of REQUIRED) {
    const value = doc[field];
    if (typeof value !== "string" || value.length === 0) {
      errors.push(`missing/empty field: ${field}`);
    }
  }

  const haystack: string[] = [String(doc.title ?? ""), String(doc.summary ?? ""), String(doc.body ?? "")];
  const apps = doc.applications as Record<string, string[]> | undefined;
  if (apps) for (const lines of Object.values(apps)) haystack.push(...lines.map(String));
  const sources = doc.primary_sources as PrimarySource[] | undefined;
  if (sources) for (const s of sources) haystack.push(Object.values(s).join(" "));

  const text = haystack.join(" ");
  for (const pat of BANNED) {
    if (pat.test(text)) errors.push(`matches banned pattern ${String(pat)}`);
  }
  return errors;
}
```

- [ ] **Step 4: Correr el test y verificar que pasa**

Run: `pnpm --filter @holy-oly/core test contentDoc`
Expected: PASS (4 tests). Verificar no-regresión: `pnpm --filter @holy-oly/core test wellnessTips`.

- [ ] **Step 5: Commit**

```bash
git add packages/core/src/data/contentDoc.ts packages/core/src/data/contentDoc.contract.test.ts
git commit -m "feat(core): contrato ContentDoc + guard no-name del lado consumidor (Holy Oly)"
```

---

## Self-Review

**Spec coverage:**
- Extracción a repo propio → T1. ✓
- Capa sport-agnostic (`applications`, compat `crossfit_application`) → T2. ✓
- Contrato `ContentDoc` + `_provenance` interno/stripped + draft→publish → T3. ✓
- Corpus publicada fuente única en huermn → T4. ✓
- `holy_oly_bridge.py` espejo de volta_bridge → T5. ✓
- Test de contrato lado consumidor (reusa patrón `wellnessTips.test.ts`) + no-regresión → T6. ✓
- Restricciones intocables (no-name, no-RPE, no-provenance) → guards en T3 (Python) y T6 (TS). ✓
- Parámetro `sport` → cubierto en `build_draft(sport)` (T3) y `holy_oly_bridge` (T5). El `sport` en el coach `/ask` en vivo queda **diferido** (es feature de Volta, no del pipeline de contenido).

**Placeholder scan:** sin TBD/TODO; todo paso de código trae código real. ✓

**Type consistency:** `ContentDoc`/`build_draft`/`publish`/`validate_published`/`SPORTS` consistentes T3↔T4; `holy_oly_recovery_to_context`/`content_query_for`/`SPORT` consistentes en T5; contrato wire snake_case (`primary_sources`) idéntico entre el YAML (T4), el `publish` de Python (T3) y la interfaz TS (T6). ✓

## Fuera de alcance (recordatorio)

Blogs (SP-2/3) · in-app · coach KB · desplegar huermn online · fusionar halterofilia dentro de huermn · auto-escribir la corpus (parafraseo es manual) · parámetro `sport` en el coach `/ask` en vivo.
