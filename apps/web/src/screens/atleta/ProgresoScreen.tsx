import { useEffect, useState } from "react";
import type { MonitorSeries } from "@holy-oly/core";
import { meClient, type MeClient } from "../../data/meClient";
import { RecorridoCard } from "./RecorridoCard";
import { LoadChart } from "../../ui/charts/LoadChart";
import { RecoveryChart } from "../../ui/charts/RecoveryChart";
import { WellnessChart } from "../../ui/charts/WellnessChart";
import { WeightChart } from "../../ui/charts/WeightChart";
import { Loading } from "../../ui/Loading";

type Load = "loading" | "ready" | "error";

/**
 * "Mi progreso" (A2) — the athlete's own trends vs their own normal. Reuses the chart components
 * with ATHLETE copy (2nd person, no ACWR) and no `onPointClick` (the coach week-detail/triage drill
 * stays coach-side). Never RPE. Honest empty state when there's no monitoring data yet.
 */
export function ProgresoScreen({ client = meClient }: { client?: MeClient } = {}) {
  const [series, setSeries] = useState<MonitorSeries | undefined>(undefined);
  const [load, setLoad] = useState<Load>("loading");

  useEffect(() => {
    let on = true;
    setLoad("loading");
    client.getMeSeries()
      .then((s) => { if (on) { setSeries(s); setLoad("ready"); } })
      .catch(() => { if (on) setLoad("error"); });
    return () => { on = false; };
  }, [client]);

  const header = (
    <div className="ho-greet">
      <div className="ho-greet__h">Mi progreso</div>
      <div className="ho-greet__s">tus tendencias vs tu propia normal</div>
    </div>
  );

  if (load === "loading") {
    return <>{header}<Loading style={{ padding: 24, fontFamily: "var(--mono)" }}>Cargando tu progreso…</Loading></>;
  }
  if (load === "error") {
    return <>{header}<div role="alert" style={{ padding: 24, color: "var(--wl-muted)", fontFamily: "var(--mono)" }}>No se pudo cargar tu progreso. Probá de nuevo más tarde.</div></>;
  }
  if (!series) {
    return (
      <>
        {header}
        <div className="ho-card">
          <div className="ho-nodata">
            <div className="ho-nodata__icon">·</div>
            <div className="ho-nodata__t">Todavía sin datos</div>
            <div className="ho-nodata__b">Cuando registres HRV, FC y carga, tus tendencias aparecen acá — con el contexto de cómo leer cada gráfico.</div>
          </div>
        </div>
        {/* El recorrido es independiente del monitoreo: con entrenos registrados, aparece igual. */}
        <RecorridoCard client={client} />
      </>
    );
  }

  const hasWeight = (series.bodyweight?.length ?? 0) > 0;

  return (
    <>
      {header}
      <div style={{ display: "grid", gap: 12 }}>
        <LoadChart
          series={series}
          title="Tu carga"
          sub="carga semanal · tu tendencia (4 sem)"
          explain={{
            forma: "Tu carga de cada semana (barras) y tu tendencia = promedio de las últimas 4 semanas (línea).",
            sirve: "Ver cómo viene tu carga semana a semana.",
            lectura: "Picos muy por encima de tu tendencia, varias semanas seguidas, son señal de cuidar el descanso.",
          }}
        />
        <RecoveryChart
          series={series}
          title="Tu recuperación"
          sub="HRV y FC en reposo vs tu normal"
          explain={{
            forma: "Tu HRV y tu FC en reposo por semana, comparadas con tu propio normal.",
            sirve: "Ver cómo venís recuperando.",
            lectura: "Mientras te mantenés en tu banda normal, vas bien. HRV cayendo o FC reposo subiendo varias semanas = momento de aflojar.",
          }}
        />
        <WellnessChart
          series={series}
          title="Tu bienestar"
          sub="score 0–100 vs tu normal · tus ítems"
          explain={{
            forma: "Tu score de bienestar (0–100) y tus 6 ítems (fatiga, dolor, estrés, humor, motivación, sueño) como tendencias.",
            sirve: "Ver cómo te venís sintiendo, más allá de los números.",
            lectura: "Se lee contra tu propia normal (la banda); cada ítem, contra su tendencia.",
          }}
        />
        {hasWeight && (
          <WeightChart
            series={series}
            title="Tu peso"
            sub="vs la banda de tu categoría"
            explain={{
              forma: "Tu peso corporal por semana vs la banda de tu categoría.",
              sirve: "Seguir si estás en el peso de tu categoría de cara a la competencia.",
              lectura: "La banda son los límites de tu categoría; el punto va verde dentro, rojo fuera.",
            }}
          />
        )}
        <RecorridoCard client={client} />
      </div>
    </>
  );
}
