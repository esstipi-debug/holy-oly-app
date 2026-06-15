import { DiscRow } from "../../../ui/Disc";

/** Medidor de INTENSIDAD = % de 1RM (NO es RPE — el atleta nunca ve RPE). Nivel base/media/alta/máxima. */
export function IntensityMeter({ pct }: { pct: number }) {
  const seg = 5;
  const filled = Math.max(1, Math.min(seg, Math.round((pct / 100) * seg)));
  const level = pct >= 90 ? "máxima" : pct >= 82 ? "alta" : pct >= 70 ? "media" : "base";
  const tone = pct >= 90 ? "max" : pct >= 82 ? "high" : pct >= 70 ? "mid" : "low";
  return (
    <div className={"et-hero__int is-" + tone}>
      <div className="et-hero__int-head">
        <span className="et-hero__int-lbl">Intensidad</span>
        <span className="et-hero__int-lvl">{level}</span>
      </div>
      <div className="et-hero__int-val">{pct}<span className="et-hero__int-pct">%</span></div>
      <div className="et-hero__int-bars" aria-hidden>
        {Array.from({ length: seg }, (_, i) => (
          <span key={i} className={"et-hero__int-bar" + (i < filled ? " is-on" : "")} style={{ height: `${42 + i * 14}%` }} />
        ))}
      </div>
    </div>
  );
}

/**
 * Hero del ejercicio con gradiente líquido animado: absorbe nombre + peso objetivo + INTENSIDAD (%1RM)
 * + discos (vía DiscRow, regla intocable). Reemplaza el encabezado cuando el ejercicio está abierto.
 * El fondo líquido es decorativo (prefers-reduced-motion lo apaga; el contenido nunca depende de él).
 */
export function ExerciseHero({
  movementName, targetKg, pct, sets, reps, barKg, nDone, total, onCollapse,
}: {
  movementName: string; targetKg?: number; pct?: number; sets: number; reps: number;
  barKg: number; nDone: number; total: number; onCollapse: () => void;
}) {
  return (
    <div className="et-hero">
      <div className="et-hero__bg" aria-hidden><span /><span /><span /><span className="et-hero__iri" /></div>
      <div className="et-hero__scrim" aria-hidden />
      <div className="et-hero__gloss" aria-hidden />
      <div className="et-hero__content">
        <div className="et-hero__top">
          <div>
            <span className="et-hero__kicker">Movimiento · {nDone}/{total} series</span>
            <span className="et-hero__name">{movementName}</span>
          </div>
          <button type="button" className="et-hero__collapse" aria-label="Cerrar ejercicio" onClick={onCollapse}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M6 15l6-6 6 6" /></svg>
          </button>
        </div>

        <div className="et-hero__mid">
          <div className="et-hero__weight">
            <div className="et-hero__kg">{targetKg != null ? targetKg : "—"}<span className="et-hero__kgu">kg</span></div>
            {targetKg != null && <div className="et-hero__discs"><DiscRow kg={targetKg} barKg={barKg} size={44} /></div>}
          </div>
          {pct != null && <IntensityMeter pct={pct} />}
        </div>

        <div className="et-hero__meta">{sets} series × {reps} {reps === 1 ? "rep" : "reps"} · por lado · barra {barKg} kg</div>
      </div>
    </div>
  );
}
