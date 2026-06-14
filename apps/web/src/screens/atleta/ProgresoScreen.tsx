import { useEffect, useState, type ReactNode } from "react";
import type { MonitorSeries } from "@holy-oly/core";
import { meClient, type MeClient } from "../../data/meClient";
import { RecorridoCard } from "./RecorridoCard";
import { MisCiclosCard } from "./MisCiclosCard";
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
 *
 * P3: una señal visible a la vez detrás de pills (Carga | Recuperación | Bienestar | Peso), en vez de
 * 4 ChartCards apilados. HR-2 intacto: cada chart visible trae su propio "ⓘ"→explica vía ChartCard.
 */
export function ProgresoScreen({ client = meClient }: { client?: MeClient } = {}) {
  const [series, setSeries] = useState<MonitorSeries | undefined>(undefined);
  const [load, setLoad] = useState<Load>("loading");
  const [active, setActive] = useState<string>("carga");

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
        {/* Historial de ciclos cerrados — también independiente del monitoreo. */}
        <div style={{ marginTop: 12 }}><MisCiclosCard client={client} /></div>
      </>
    );
  }

  const hasWeight = (series.bodyweight?.length ?? 0) > 0;

  // Una señal por pill. Carga va primera y SIEMPRE presente → la key activa nunca queda colgada.
  // Peso es condicional (igual que el card de antes): sin bodyweight, no hay pill Peso.
  const pills: { key: string; label: string; render: () => ReactNode }[] = [
    {
      key: "carga", label: "Carga",
      render: () => (
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
      ),
    },
    {
      key: "recuperacion", label: "Recuperación",
      render: () => (
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
      ),
    },
    {
      key: "bienestar", label: "Bienestar",
      render: () => (
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
      ),
    },
    ...(hasWeight
      ? [{
          key: "peso", label: "Peso",
          render: () => (
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
          ),
        }]
      : []),
  ];
  // Guarda: si la pill activa desaparece (p. ej. dejó de haber bodyweight), volvemos a Carga.
  const current = pills.find((p) => p.key === active) ?? pills[0]!;

  return (
    <>
      {header}
      <div className="ho-seg" role="group" aria-label="Señal a ver" style={{ marginBottom: 12 }}>
        {pills.map((p) => (
          <button
            key={p.key}
            type="button"
            aria-pressed={active === p.key}
            className={active === p.key ? "on" : ""}
            onClick={() => setActive(p.key)}
            style={{ minHeight: 44 }}
          >
            {p.label}
          </button>
        ))}
      </div>
      {current.render()}
      <div style={{ marginTop: 12 }}>
        <RecorridoCard client={client} />
      </div>
      <div style={{ marginTop: 12 }}>
        <MisCiclosCard client={client} />
      </div>
    </>
  );
}
