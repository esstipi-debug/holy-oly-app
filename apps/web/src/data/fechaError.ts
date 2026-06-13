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
