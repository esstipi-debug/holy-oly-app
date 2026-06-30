import type { StreakHeadsUp, WatchedWellnessField } from "@holy-oly/core";
import { STATUS } from "../../../ui/status";

/** Copy del aviso (Spanish hardcoded, como el Titular vecino — "Hoy" aún no está en i18n).
 *  Consecuencia REVERSIBLE y sentida; jamás readiness/sobreentrenamiento/RPE (HR-1). */
const FACTOR: Record<WatchedWellnessField, string> = {
  sueno: "durmiendo mal",
  estres: "con la cabeza a full",
  fatiga: "muy cansada",
  dolor: "con molestias",
  motivacion: "sin ganas",
};
const CONSEQ: Record<WatchedWellnessField, string> = {
  sueno: "vas a notar la recuperación caer y el plan se te va a hacer más pesado",
  estres: "te va a costar concentrarte y sostener la intensidad",
  fatiga: "el cansancio se acumula y vas a rendir por debajo de lo tuyo",
  dolor: "forzar sobre una molestia que no cede puede frenarte",
  motivacion: "las ganas se siguen apagando y te va a costar arrancar las sesiones",
};
const ACTION: Record<WatchedWellnessField, string> = {
  sueno: "Esta semana bajá un cambio y priorizá descanso.",
  estres: "Buscá bajar revoluciones fuera del gym.",
  fatiga: "Date margen: dormir y comer mejor esta semana.",
  dolor: "Contáselo a tu coach antes de cargar fuerte.",
  motivacion: "Aflojá la exigencia un toque; volvé a lo que disfrutás.",
};
const TO_COACH = "Conviene que se lo cuentes a tu coach.";

/** Bloque "Atención" de Hoy: aparece SOLO con una racha activa (si esto sigue, va a pasar X).
 *  Reusa la clase .ho-titular del Titular para no agregar CSS. */
export function AtencionBlock({ headsUp }: { headsUp: StreakHeadsUp | null | undefined }) {
  if (!headsUp) return null;
  const { item, days, severity } = headsUp;
  const col = severity === "alert" ? STATUS.alert : STATUS.warn;
  const action = severity === "alert" || item === "dolor" ? TO_COACH : ACTION[item];
  return (
    <section aria-label="Atención" className="ho-titular" style={{
      background: `color-mix(in srgb, ${col} 14%, transparent)`,
      borderColor: `color-mix(in srgb, ${col} 45%, transparent)`,
    }}>
      <div className="ho-titular__row">
        <span className="ho-titular__dot" style={{ background: col, boxShadow: `0 0 18px ${col}99` }} />
        <div>
          <div className="ho-titular__lbl">Atención</div>
          <div className="ho-titular__st" style={{ color: col }}>Llevás {days} días {FACTOR[item]}</div>
        </div>
      </div>
      <p className="ho-titular__msg">Si sigue, <b>{CONSEQ[item]}</b>. {action}</p>
    </section>
  );
}
