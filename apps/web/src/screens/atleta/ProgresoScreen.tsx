import { useEffect, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
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

/**
 * "Mi progreso" (A2 · rediseño 0110) — carrusel de señales con hero (valor grande + delta vs tu
 * normal) + mini-stats + MAPA DE CALOR de calendario por día (reemplaza los gráficos de línea para
 * calzar con el mock). El hero/stats salen de `series` (semanal); el mapa, de `getMeHeatDays`
 * (datos REALES por día: carga/bienestar/peso/recuperación). Si el mapa no carga, cae al gráfico de
 * línea como fallback. Primer slide: "Camino a la competencia". "Tu recorrido" + ciclo se mantienen.
 * Nunca RPE. Sin `series` → estado honesto "Todavía sin datos" (atleta nuevo sin monitoreo).
 */
export function ProgresoScreen({ client = meClient }: { client?: MeClient } = {}) {
  const { t } = useTranslation("atleta");
  const [series, setSeries] = useState<MonitorSeries | undefined>(undefined);
  const [planView, setPlanView] = useState<MePlanView | undefined>(undefined);
  const [heat, setHeat] = useState<MeHeatDays | undefined>(undefined);
  const [load, setLoad] = useState<Load>("loading");

  // HR-2: cada señal explica «cómo se forma / para qué sirve / contra qué se lee». Textos del mapa de
  // calor (rediseño 0110): cada celda = un día. NUNCA mencionan RPE.
  const EXPLAIN = {
    carga: {
      forma: t("progExplainCargaForma"),
      sirve: t("progExplainCargaSirve"),
      lectura: t("progExplainCargaLectura"),
    },
    recuperacion: {
      forma: t("progExplainRecuperacionForma"),
      sirve: t("progExplainRecuperacionSirve"),
      lectura: t("progExplainRecuperacionLectura"),
    },
    bienestar: {
      forma: t("progExplainBienestarForma"),
      sirve: t("progExplainBienestarSirve"),
      lectura: t("progExplainBienestarLectura"),
    },
    peso: {
      forma: t("progExplainPesoForma"),
      sirve: t("progExplainPesoSirve"),
      lectura: t("progExplainPesoLectura"),
    },
  };

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
      <div className="ho-greet__h">{t("progTitle")}</div>
      <div className="ho-greet__s">{t("progSubtitle")}</div>
    </div>
  );

  if (load === "loading") {
    return <>{header}<Loading style={{ padding: 24, fontFamily: "var(--mono)" }}>{t("progLoading")}</Loading></>;
  }
  if (load === "error") {
    return <>{header}<div role="alert" style={{ padding: 24, color: "var(--wl-muted)", fontFamily: "var(--mono)" }}>{t("progLoadError")}</div></>;
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
        <SignalCard name={t("progSignalCargaName")} sub={t("progSignalCargaSub")} display={cargaDisplay(series)} explain={EXPLAIN.carga}>
          {chart("carga", <LoadChart series={series} bare />)}
        </SignalCard>
      ),
    });
    signalSlides.push({
      key: "recuperacion",
      node: (
        <SignalCard name={t("progSignalRecuperacionName")} sub={t("progSignalRecuperacionSub")} display={recuperacionDisplay(series)} explain={EXPLAIN.recuperacion}>
          {chart("recuperacion", <RecoveryChart series={series} bare />)}
        </SignalCard>
      ),
    });
    signalSlides.push({
      key: "bienestar",
      node: (
        <SignalCard name={t("progSignalBienestarName")} sub={t("progSignalBienestarSub")} display={bienestarDisplay(series)} explain={EXPLAIN.bienestar}>
          {chart("bienestar", <WellnessChart series={series} bare />)}
        </SignalCard>
      ),
    });
    const peso = pesoDisplay(series);
    if (peso) {
      signalSlides.push({
        key: "peso",
        node: (
          <SignalCard name={t("progSignalPesoName")} sub={t("progSignalPesoSub")} display={peso} explain={EXPLAIN.peso}>
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
            <div className="ho-nodata__t">{t("progNoDataTitle")}</div>
            <div className="ho-nodata__b">{t("progNoDataBody")}</div>
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
