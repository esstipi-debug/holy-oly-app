# ADR — Región de datos y base legal (E8)

- **Fecha:** 2026-06-07
- **Estado:** Propuesto (requiere decisión del owner)

## Contexto
Holy Oly corre en **Render US (Oregon)** (`render.yaml`, `docs/superpowers/DEPLOY.md`). Almacena
datos de salud-adyacentes (ciclo menstrual `CycleConsent`, daylogs de bienestar) de usuarios
mayormente de **Argentina / LatAm**. Esto implica una **transferencia internacional** de datos
personales sensibles bajo la **Ley 25.326 (AR)** y normativas equivalentes de la región.

## Decisión (a tomar por el owner)
Opciones:
1. **Mantener US-Oregon** + documentar base legal: consentimiento informado del usuario +
   aviso de privacidad que indique explícitamente dónde se alojan los datos y que hay transferencia
   internacional. (Más simple; aceptable para MVP/beta con consentimiento claro.)
2. **Mover a una región LatAm/EU** o a un proveedor con presencia regional, si la asesoría legal lo
   exige para datos de salud a escala.

**Recomendación interina:** Opción 1 con aviso de privacidad explícito **antes** de abrir registro
masivo, y re-evaluar (Opción 2) si crece el volumen o lo exige la asesoría legal.

## Consecuencias
- Hay que escribir/āctualizar el **aviso de privacidad** declarando: ubicación de datos (US),
  transferencia internacional, finalidad, y los derechos de export/borrado (D3/D4).
- El cifrado de ciclo en reposo (**D1**) reduce el riesgo de la transferencia (el dato sensible
  viaja/rest cifrado), pero no elimina la obligación de transparencia.
- Si se elige Opción 2, es un proyecto de migración de infra (DB + servicio) — no trivial.

## Pendiente
- [ ] Decisión del owner (Opción 1 vs 2).
- [ ] Aviso de privacidad redactado y enlazado desde la app.
- [ ] Confirmar con asesoría legal para datos de salud LatAm.
