# Autoría de tips de wellness (huermn → Holy Oly)

`huberman-tips-draft.mjs` consulta la **API local de Huberman** (`huermn`, RAG en
`C:\volta-atlas\packages\huermn`) y emite un **borrador** para escribir tips nuevos en
`packages/core/src/data/wellnessTips.ts`.

## Por qué un script de autoría (y no una llamada en runtime)

- huermn es **localhost** (`127.0.0.1:8000`) — producción (Render) no la alcanza.
- El contenido de Huberman es **legal-sensible** para un producto que cobra.
- Por eso Holy Oly embarca un **JSON estático** (`WELLNESS_TIPS`) y huermn es sólo **autoría offline**.

## 🔴 Regla intocable (la blinda `wellnessTips.test.ts`)

Los tips son **hechos/protocolos parafraseados** (palabras propias, nunca texto copiado), con
**atribución genérica** (`SRC`). **La fuente NUNCA se nombra en el producto** — nada de "Huberman"
en `title`/`body`/`source`. Sin RPE. Advisory, no prescriptivo. La procedencia (URL/episodio) queda
sólo en el borrador de autoría, jamás en el tip embarcado.

Por eso el script **no escribe `wellnessTips.ts`**: produce un `.md` para que vos parafrasees a mano.

## Uso

```bash
# 1) Ver las queries planeadas (no necesita huermn)
node scripts/wellness/huberman-tips-draft.mjs --dry-run

# 2) Levantar huermn
cd C:\volta-atlas\packages\huermn
# (crear venv + deps la 1ª vez: python -m venv .venv && .venv\Scripts\pip install -r requirements.txt)
uvicorn api.main:app --port 8000

# 3) Generar el borrador (escribe docs/wellness/huberman-drafts.md)
node scripts/wellness/huberman-tips-draft.mjs
# o apuntando a otra URL/host:
HUERMN=http://127.0.0.1:8000 node scripts/wellness/huberman-tips-draft.mjs
```

## Flujo de autoría

1. Corré el script → `docs/wellness/huberman-drafts.md` (hechos candidatos + procedencia interna).
2. **Parafraseá** cada hecho a un `WellnessTip` nuevo en `wellnessTips.ts`:
   - `states` (`ok`/`warn`/`alert`) + `items` (señal del check-in) ya vienen sugeridos.
   - `title` = el QUÉ corto; `body` = el protocolo en palabras propias; `source: SRC` (genérico).
   - **Nunca** escribas "Huberman" ni cites una URL en el tip. **Nunca** menciones RPE.
3. Corré el test de regresión:
   ```bash
   pnpm --filter @holy-oly/core test wellnessTips
   ```
   Garantiza: ningún tip nombra la fuente ni RPE, atribución presente, estados válidos.

> El borrador (`docs/wellness/huberman-drafts.md`) es scratch de autoría; podés no commitearlo.
> Requiere Node 18+ (usa `fetch` global). Cero dependencias.
