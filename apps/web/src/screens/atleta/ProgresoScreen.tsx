import { useEffect, useState, type ReactNode } from "react";
import type { MonitorSeries, MePlanView, MeHeatDays } from "@holy-oly/core";
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
import { SignalHeat } from "./progreso/SignalHeat";
import type { SignalKey } from "./progreso/heatSpecs";
import { cargaDisplay, recuperacionDisplay, bienestarDisplay, pesoDisplay } from "./progreso/signalData";

type Load = "loading" | "ready" | "error";

// HR-2: cada señal explica «cómo se forma / para qué sirve / contra qué se lee». Textos del mapa de
// calor (rediseño 0110): cada celda = un día. NUNCA mencionan RPE.
const EXPLAIN = {
  carga: {
    forma: "Cada celda es un día; el color sube con el volumen (kg de trabajo) que moviste ese día. Los días sin entrenar quedan en gris.",
    sirve: "Ver tu carga día a día y semana a semana, frente a tu propia base.",
    lectura: "Rachas de días muy intensos seguidos sin descanso son señal de cuidar la recuperación.",
  },
  recuperacion: {
    forma: "Cada celda es un día; el color sigue tu HRV de esa semana del macro (más alto = mejor recuperación). Fuera del macro queda en gris.",
    sirve: "Leer cómo venís recuperando, más allá de cómo entrenaste.",
    lectura: "Dentro de tu banda, vas bien. HRV cayendo o FC reposo subiendo varias semanas = momento de aflojar.",
  },
  bienestar: {
    forma: "Cada celda es un día; el color sube con tu score de bienestar (0–100) de ese día — el promedio de tus 6 ítems del check-in.",
    sirve: "Ver cómo te venís sintiendo, más allá de los números fisiológicos.",
    lectura: "Se lee contra tu propia normal; los días sin check-in quedan en gris.",
  },
  peso: {
    forma: "Cada celda es un día; cuanto más cerca de tu categoría (en banda), más intenso el color.",
    sirve: "Seguir si estás en el peso de tu categoría de cara a la competencia.",
    lectura: "La banda son los límites de tu categoría; los días sin pesarte quedan en gris.",
  },
};

/**
 * "Mi progreso" (A2 · rediseño 0110) — carrusel de señales con hero (valor grande + delta vs tu
 * normal) + mini-stats + MAPA DE CALOR de calendario por día (reemplaza los gráficos de línea para
 * calzar con el mock). El hero/stats salen de `series` (semanal); el mapa, de `getMeHeatDays`
 * (datos REALES por día: carga/bienestar/peso/recuperación). Si el mapa no carga, cae al gráfico de
 * línea como fallback. Primer slide: "Camino a la competencia". "Tu recorrido" + ciclo se mantienen.
 * Nunca RPE. Sin `series` → estado honesto "Todavía sin datos" (atleta nuevo sin monitoreo).
 */
export function ProgresoScreen({ client = meClient }: { client?: MeClient } = {}) {
  const [series, setSeries] = useState<MonitorSeries | undefined>(undefined);
  const [planView, setPlanView] = useState<MePlanView | undefined>(undefined);
  const [heat, setHeat] = useState<MeHeatDays | undefined>(undefined);
  const [load, setLoad] = useState<Load>("loading");

  useEffect(() => {
    let on = true;
    setLoad("loading");
    // Plan y mapa de calor con catch propio: un fallo de cualquiera NO tumba el progreso (Camino cae
    // a su empty; las señales caen al gráfico de línea de fallback).
    const planP = client.getMePlan().then((p) => p as MePlanView | undefined, () => undefined);
    const heatP = client.getMeHeatDays().then((h) => h, () => undefined);
    client.getMeSeries()
      .then(async (s) => {
        const [p, h] = await Promise.all([planP, heatP]);
        if (on) { setSeries(s); setPlanView(p); setHeat(h); setLoad("ready"); }
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

  // El chart de cada señal: el MAPA DE CALOR (rediseño 0110) cuando hay datos por día; si no cargó,
  // cae al gráfico de línea semanal como fallback (sin regresión).
  const chart = (key: SignalKey, fallback: ReactNode): ReactNode =>
    heat ? <SignalHeat data={heat} signal={key} /> : fallback;

  // Slides de señales: sólo con serie (el hero/stats son semanales). Peso es condicional.
  const signalSlides: CarouselSlide[] = [];
  if (series) {
    signalSlides.push({
      key: "carga",
      node: (
        <SignalCard name="Tu carga" sub="carga semanal vs tu tendencia" display={cargaDisplay(series)} explain={EXPLAIN.carga}>
          {chart("carga", <LoadChart series={series} bare />)}
        </SignalCard>
      ),
    });
    signalSlides.push({
      key: "recuperacion",
      node: (
        <SignalCard name="Tu recuperación" sub="HRV y FC en reposo vs tu normal" display={recuperacionDisplay(series)} explain={EXPLAIN.recuperacion}>
          {chart("recuperacion", <RecoveryChart series={series} bare />)}
        </SignalCard>
      ),
    });
    signalSlides.push({
      key: "bienestar",
      node: (
        <SignalCard name="Tu bienestar" sub="score 0–100 vs tu normal · tus ítems" display={bienestarDisplay(series)} explain={EXPLAIN.bienestar}>
          {chart("bienestar", <WellnessChart series={series} bare />)}
        </SignalCard>
      ),
    });
    const peso = pesoDisplay(series);
    if (peso) {
      signalSlides.push({
        key: "peso",
        node: (
          <SignalCard name="Tu peso" sub="vs la banda de tu categoría" display={peso} explain={EXPLAIN.peso}>
            {chart("peso", <WeightChart series={series} bare />)}
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
