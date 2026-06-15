import { useEffect, useState } from "react";
import type { MonitorSeries, MePlanView } from "@holy-oly/core";
import { meClient, type MeClient } from "../../data/meClient";
import { RecorridoCard } from "./RecorridoCard";
import { MisCiclosCard } from "./MisCiclosCard";
import { CaminoCard } from "./hoy/CaminoCard";
import { LoadChart } from "../../ui/charts/LoadChart";
import { RecoveryChart } from "../../ui/charts/RecoveryChart";
import { WellnessChart } from "../../ui/charts/WellnessChart";
import { WeightChart } from "../../ui/charts/WeightChart";
import { Loading } from "../../ui/Loading";
import { ProgresoCarousel, type CarouselSlide } from "./progreso/ProgresoCarousel";
import { SignalCard } from "./progreso/SignalCard";
import { cargaDisplay, recuperacionDisplay, bienestarDisplay, pesoDisplay } from "./progreso/signalData";

type Load = "loading" | "ready" | "error";

const EXPLAIN = {
  carga: {
    forma: "Tu carga de cada semana (barras) y tu tendencia = promedio de las últimas 4 semanas (línea).",
    sirve: "Ver cómo viene tu carga semana a semana.",
    lectura: "Picos muy por encima de tu tendencia, varias semanas seguidas, son señal de cuidar el descanso.",
  },
  recuperacion: {
    forma: "Tu HRV y tu FC en reposo por semana, comparadas con tu propio normal.",
    sirve: "Ver cómo venís recuperando.",
    lectura: "Mientras te mantenés en tu banda normal, vas bien. HRV cayendo o FC reposo subiendo varias semanas = momento de aflojar.",
  },
  bienestar: {
    forma: "Tu score de bienestar (0–100) y tus 6 ítems (fatiga, dolor, estrés, humor, motivación, sueño) como tendencias.",
    sirve: "Ver cómo te venís sintiendo, más allá de los números.",
    lectura: "Se lee contra tu propia normal (la banda); cada ítem, contra su tendencia.",
  },
  peso: {
    forma: "Tu peso corporal por semana vs la banda de tu categoría.",
    sirve: "Seguir si estás en el peso de tu categoría de cara a la competencia.",
    lectura: "La banda son los límites de tu categoría; el punto va verde dentro, rojo fuera.",
  },
};

/**
 * "Mi progreso" (A2 · rediseño 0110) — carrusel de señales con hero (valor grande + delta vs tu
 * normal) + mini-stats, reusando los charts de línea en modo `bare`. Primer slide: "Camino a la
 * competencia" (reusa la card del Home; sin readiness/RM). "Tu recorrido" + ciclo se mantienen.
 * Nunca RPE. El carrusel de señales sólo se arma con `series`; el guard `!series` muestra el estado
 * honesto "Todavía sin datos" (atleta nuevo sin monitoreo), preservado del diseño A2.
 */
export function ProgresoScreen({ client = meClient }: { client?: MeClient } = {}) {
  const [series, setSeries] = useState<MonitorSeries | undefined>(undefined);
  const [planView, setPlanView] = useState<MePlanView | undefined>(undefined);
  const [load, setLoad] = useState<Load>("loading");

  useEffect(() => {
    let on = true;
    setLoad("loading");
    // El plan se carga con catch propio: un fallo de plan NO tumba el progreso (Camino cae a su empty).
    const planP = client.getMePlan().then((p) => p as MePlanView | undefined, () => undefined);
    client.getMeSeries()
      .then(async (s) => {
        const p = await planP;
        if (on) { setSeries(s); setPlanView(p); setLoad("ready"); }
      })
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

  // El primer slide (Camino) es independiente del monitoreo y se autogestiona si no hay plan.
  const caminoSlide: CarouselSlide = {
    key: "camino",
    node: <CaminoCard plan={planView?.plan ?? null} client={client} sexo={planView?.athlete.sexo} />,
  };

  // Slides de señales: sólo con serie. Peso es condicional (sin bodyweight → no hay slide).
  const signalSlides: CarouselSlide[] = [];
  if (series) {
    signalSlides.push({
      key: "carga",
      node: (
        <SignalCard name="Tu carga" sub="carga semanal vs tu tendencia" display={cargaDisplay(series)} explain={EXPLAIN.carga}>
          <LoadChart series={series} bare />
        </SignalCard>
      ),
    });
    signalSlides.push({
      key: "recuperacion",
      node: (
        <SignalCard name="Tu recuperación" sub="HRV y FC en reposo vs tu normal" display={recuperacionDisplay(series)} explain={EXPLAIN.recuperacion}>
          <RecoveryChart series={series} bare />
        </SignalCard>
      ),
    });
    signalSlides.push({
      key: "bienestar",
      node: (
        <SignalCard name="Tu bienestar" sub="score 0–100 vs tu normal · tus ítems" display={bienestarDisplay(series)} explain={EXPLAIN.bienestar}>
          <WellnessChart series={series} bare />
        </SignalCard>
      ),
    });
    const peso = pesoDisplay(series);
    if (peso) {
      signalSlides.push({
        key: "peso",
        node: (
          <SignalCard name="Tu peso" sub="vs la banda de tu categoría" display={peso} explain={EXPLAIN.peso}>
            <WeightChart series={series} bare />
          </SignalCard>
        ),
      });
    }
  }

  const slides: CarouselSlide[] = [caminoSlide, ...signalSlides];

  return (
    <>
      {header}
      <ProgresoCarousel slides={slides} storageKey="ho:progreso-signal" />
      {!series && (
        <div className="ho-card" style={{ marginTop: 12 }}>
          <div className="ho-nodata">
            <div className="ho-nodata__icon">·</div>
            <div className="ho-nodata__t">Todavía sin datos</div>
            <div className="ho-nodata__b">Cuando registres HRV, FC y carga, tus tendencias aparecen acá — con el contexto de cómo leer cada gráfico.</div>
          </div>
        </div>
      )}
      <div style={{ marginTop: 12 }}>
        <RecorridoCard client={client} />
      </div>
      <div style={{ marginTop: 12 }}>
        <MisCiclosCard client={client} />
      </div>
    </>
  );
}
