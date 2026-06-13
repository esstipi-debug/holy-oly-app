/**
 * Versiones vigentes de los documentos legales y del consentimiento del ciclo.
 *
 * Fuente de verdad ÚNICA, compartida core ↔ api ↔ web:
 *  - El backend SELLA estas versiones al registrar la aceptación (jamás confía en una versión
 *    enviada por el cliente — el cliente sólo dice "acepto", el server decide qué versión es).
 *  - Las páginas legales muestran la versión + fecha vigente.
 *  - Cuando un documento cambie materialmente, subí la versión acá: eso habilita (más adelante)
 *    forzar la re-aceptación de quienes aceptaron una versión anterior.
 */

/** Versión vigente de los Términos de uso. */
export const LEGAL_TERMS_VERSION = "v1";
/** Versión vigente de la Política de privacidad. */
export const LEGAL_PRIVACY_VERSION = "v1";
/** Fecha de entrada en vigencia de los documentos `v1` (YYYY-MM-DD). */
export const LEGAL_EFFECTIVE_DATE = "2026-06-13";

/** Versión del consentimiento informado del módulo de ciclo (acto de opt-in de la atleta). */
export const CYCLE_CONSENT_VERSION = "v1";

/** Marca de las cuentas/registros previos a la trazabilidad de aceptación (migración legacy). */
export const LEGAL_LEGACY_VERSION = "v0-stub";
