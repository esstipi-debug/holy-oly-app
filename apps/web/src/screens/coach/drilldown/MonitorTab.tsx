import type { Macrocycle, MonitorSeries } from "@holy-oly/core";
import { AcwrChart } from "../../../ui/charts/AcwrChart";
import { LoadChart } from "../../../ui/charts/LoadChart";
import { ImrFaseChart } from "../../../ui/charts/ImrFaseChart";
import { WeightChart } from "../../../ui/charts/WeightChart";

type Props = {
  series?: MonitorSeries;
  macro?: Macrocycle;
  /** Abre el WeekDetailSheet del shell (estado parent-owned, compartido con el calendario de Plan). */
  onPointClick: (week: number) => void;
};

/** Monitor: las 4 señales coach-only de carga y periodización — ACWR · Carga · IMR vs fase · Peso.
 *  Bienestar y Cumplimiento salieron (los cubre Resumen: "Bienestar" y "Adherencia"); Recuperación
 *  salió (depende de datos HRV/FC que los atletas no registran). NUNCA fluyen a una superficie del
 *  atleta. Empty-state honesto cuando aún no hay monitoreo. */
export function MonitorTab({ series, macro, onPointClick }: Props) {
  if (!series) {
    return (
      <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--wl-muted)", margin: "16px 0" }}>
        Este atleta aún sin datos de monitoreo. Cuando registre su carga, aparecerán acá.
      </div>
    );
  }
  return (
    <div style={{ display: "grid", gap: 12 }}>
      <AcwrChart series={series} onPointClick={onPointClick} />
      <LoadChart series={series} onPointClick={onPointClick} />
      {macro && <ImrFaseChart series={series} macro={macro} onPointClick={onPointClick} />}
      {series.bodyweight && series.bodyweight.length > 0 && <WeightChart series={series} onPointClick={onPointClick} />}
    </div>
  );
}
