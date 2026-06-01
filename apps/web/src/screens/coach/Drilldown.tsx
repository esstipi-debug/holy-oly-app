import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { useRepository } from "../../data/RepositoryProvider";
import { MACROCYCLES, rosterStatus, type Atleta, type Macrocycle, type Medal, type MonitorSeries } from "@holy-oly/core";
import { ROSTER_META } from "../../data/seeds";
import { AcwrChart } from "../../ui/charts/AcwrChart";
import { LoadChart } from "../../ui/charts/LoadChart";
import { RecoveryChart } from "../../ui/charts/RecoveryChart";
import { ImrFaseChart } from "../../ui/charts/ImrFaseChart";
import { WellnessChart } from "../../ui/charts/WellnessChart";
import { CompChart } from "../../ui/charts/CompChart";
import { WeightChart } from "../../ui/charts/WeightChart";
import { Medal as MedalIcon } from "../../ui/Medal";
import { Badge } from "../../ui/Badge";

export function Drilldown() {
  const { id = "" } = useParams();
  const repo = useRepository();
  const [athlete, setAthlete] = useState<Atleta | undefined>();
  const [series, setSeries] = useState<MonitorSeries | undefined>();
  const [medals, setMedals] = useState<Medal[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    let on = true;
    setLoaded(false); setError(false); // reset on athlete change so a prior error/data doesn't stick
    Promise.all([repo.getAthlete(id), repo.getSeries(id), repo.getMedals(id)])
      .then(([a, s, m]) => {
        if (!on) return;
        setAthlete(a); setSeries(s); setMedals(m); setLoaded(true);
      })
      .catch(() => { if (on) { setError(true); setLoaded(true); } });
    return () => { on = false; };
  }, [repo, id]);

  if (!loaded) return <div aria-busy="true" style={{ padding: 24, color: "var(--wl-muted)" }}>Cargando…</div>;
  if (error) return <div style={{ padding: 24, color: "var(--wl-text)" }}>No se pudo cargar el atleta. Reintentá.</div>;
  if (!athlete) return <div style={{ padding: 24, color: "var(--wl-text)" }}>Atleta no encontrado.</div>;

  const macro: Macrocycle | undefined = athlete.macroId ? MACROCYCLES.find((m) => m.id === athlete.macroId) : undefined;
  const metodo = ROSTER_META[athlete.id]?.metodo ?? "";
  const cell = rosterStatus(series);
  const estadoLabel = cell === "alert" ? "Alerta" : cell === "warn" ? "Vigilar" : cell === "ok" ? "OK" : "Sin datos";
  const counts = { oro: 0, plata: 0, bronce: 0 } as Record<Medal["medal"], number>;
  for (const m of medals) counts[m.medal]++;

  return (
    <div style={{ padding: "14px 13px 26px", color: "var(--wl-text)", background: "var(--wl-bg)", minHeight: "100vh", maxWidth: 390, margin: "0 auto" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: 8 }}>
        <div>
          <div style={{ fontFamily: "var(--wl-display)", fontWeight: 800, fontSize: 22, lineHeight: 1 }}>{athlete.nombre}</div>
          <div style={{ fontFamily: "var(--mono)", fontSize: 10.5, color: "var(--wl-muted)", marginTop: 6 }}>
            {metodo}{macro ? ` · ${macro.duration}` : ""}
          </div>
        </div>
        {cell === "none"
          ? <span style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--wl-muted)", border: "1px solid color-mix(in srgb,var(--wl-text) 16%,transparent)", padding: "3px 8px", borderRadius: 99 }}>{estadoLabel}</span>
          : <Badge tone={cell}>{estadoLabel}</Badge>}
      </div>

      {series ? (
        <div style={{ display: "grid", gap: 12, marginTop: 14 }}>
          <AcwrChart series={series} />
          <LoadChart series={series} />
          <RecoveryChart series={series} />
          {macro && <ImrFaseChart series={series} macro={macro} />}
          {series.wellness.length > 0 && <WellnessChart series={series} />}
          {series.compliance && series.compliance.length > 0 && <CompChart series={series} />}
          {series.bodyweight && series.bodyweight.length > 0 && <WeightChart series={series} />}
        </div>
      ) : (
        <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--wl-muted)", margin: "16px 0" }}>
          Este atleta aún sin datos de monitoreo. Cuando registre HRV/FC/carga, aparecerán acá.
        </div>
      )}

      <div style={{ marginTop: 16, fontFamily: "var(--wl-display)", fontWeight: 700, fontSize: 13.5 }}>Palmarés · competencias</div>
      <div style={{ display: "flex", gap: 12, alignItems: "center", margin: "8px 0" }}>
        {(["oro", "plata", "bronce"] as const).map((k) => (
          <span key={k} style={{ display: "flex", alignItems: "center", gap: 4 }}>
            <MedalIcon metal={k} size={22} />
            <b style={{ fontFamily: "var(--mono)", fontSize: 12 }}>{counts[k]}</b>
          </span>
        ))}
      </div>
      {medals.length === 0 ? (
        <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--wl-muted)" }}>Sin medallas registradas.</div>
      ) : (
        medals.map((m, i) => (
          <div key={`${m.date}-${m.comp}-${m.medal}-${i}`} style={{ display: "flex", gap: 10, alignItems: "center", padding: "6px 0", borderTop: "1px solid color-mix(in srgb,var(--wl-text) 6%,transparent)" }}>
            <MedalIcon metal={m.medal} size={26} />
            <div>
              <div style={{ fontFamily: "var(--wl-display)", fontWeight: 700, fontSize: 12 }}>{m.comp}</div>
              <div style={{ fontFamily: "var(--mono)", fontSize: 9, color: "var(--wl-muted)" }}>{m.date} · {m.cat} · Arr {m.sn} · Env {m.cj} · Total {m.sn + m.cj}</div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
