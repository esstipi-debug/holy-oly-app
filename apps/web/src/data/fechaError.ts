/**
 * Error tipado para la regla D1 (1 entreno por fecha). Vive en su propio módulo para que
 * `httpMeClient` pueda importarlo sin crear un ciclo con `meClient` (que re-exporta de
 * `httpMeClient` y a su vez importa de aquí).
 */
export class FechaOcupadaError extends Error {
  constructor(public readonly conflicto: { week: number; sessionIdx: number; fecha: string }) {
    super("fecha_ocupada");
  }
}

/**
 * Error tipado para la secuencia de días (2026-06-13): la sesión que se quiere completar/anular
 * tiene días anteriores sin resolver en la semana. `faltan` = sessionIdx de esos días. Vive acá
 * por la misma razón que FechaOcupadaError (sin ciclo de imports con meClient).
 */
export class DiaBloqueadoError extends Error {
  constructor(public readonly faltan: number[] = []) {
    super("dia_bloqueado");
  }
}
