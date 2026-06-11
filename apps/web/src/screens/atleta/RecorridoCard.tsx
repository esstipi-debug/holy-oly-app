import { useEffect, useState } from "react";
import type { MePlanView, MeRecorrido } from "@holy-oly/core";
import { meClient, type MeClient } from "../../data/meClient";

const CL = (n: number): string => n.toLocaleString("es-CL");

type Load = "loading" | "ready" | "error";

const BAR_AREA_H = 44; // alto del área de barras (px); la semana máxima llena el área
const TICK_ZONE_H = 4; // zona bajo cada barra reservada al tick de HOY (2px tick + 2px de aire)
const FUTURE_OPACITY = 0.35; // semanas futuras: más atenuadas que las pasadas-sin-registro

/**
 * «Tu recorrido» (recorrido D1, altura macro): lo HECHO acumulado del plan — total grande,
 * desglose trabajo/calentamiento (regla 06-11: la rampa es volumen visible, jamás del monitor)
 * y barras por semana sin charts nuevos (botones, alto ∝ kg). Sólo carga PROPIA en kg (HR-1).
 * Detalle por TAP (rulebook §4: tap, no hover — jamás tooltips); la semana actual lleva tick
 * (HOY) y las futuras van atenuadas — semana 3 de 16 no debe leer 13 barras como falladas.
 * Recorrido vacío → no renderiza nada (sin culpa). Error → alert + Reintentar (patrón D5).
 */
export function RecorridoCard({ client = meClient }: { client?: MeClient } = {}) {
  const [recorrido, setRecorrido] = useState<MeRecorrido | null>(null);
  const [plan, setPlan] = useState<MePlanView | null>(null);
  const [load, setLoad] = useState<Load>("loading");
  const [stamp, setStamp] = useState(0); // Reintentar re-dispara el load vía stamp (mantiene la cancelación del effect)
  const [sel, setSel] = useState<number | null>(null); // semana tocada (detail-on-tap); tocar la misma la cierra

  useEffect(() => {
    let on = true;
    setLoad("loading");
    // El plan sólo aporta currentWeek (marca de HOY / futuro atenuado): si falla, la card
    // degrada con gracia (sin tick ni atenuación) en vez de perder el recorrido entero.
    Promise.all([client.getMeRecorrido(), client.getMePlan().catch(() => null)])
      .then(([r, p]) => { if (on) { setRecorrido(r); setPlan(p); setLoad("ready"); } })
      .catch(() => { if (on) setLoad("error"); });
    return () => { on = false; };
  }, [client, stamp]);

  // Mientras carga no ocupa lugar: si el recorrido viene vacío la card no existe, y un
  // placeholder que aparece y desaparece sería peor que nada.
  if (load === "loading") return null;

  if (load === "error") {
    return (
      <div className="ho-card">
        <div className="ho-card__head"><span className="ho-card__t">Tu recorrido</span></div>
        <div role="alert" style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--wl-muted)", marginTop: 8 }}>
          No se pudo cargar tu recorrido.{" "}
          <button
            type="button"
            onClick={() => setStamp((s) => s + 1)}
            style={{ background: "none", border: "none", color: "var(--wl-accent)", cursor: "pointer", fontFamily: "var(--mono)", fontSize: 11, padding: 0, textDecoration: "underline" }}
          >
            Reintentar
          </button>
        </div>
      </div>
    );
  }

  const semanas = recorrido?.semanas ?? [];
  const conRegistro = semanas.filter((s) => s.sesionesHechas > 0 || s.trabajoKg + s.calentamientoKg > 0).length;
  if (conRegistro === 0) return null; // sin nada hecho todavía → sin card, sin culpa

  const trabajo = semanas.reduce((a, s) => a + s.trabajoKg, 0);
  const calentamiento = semanas.reduce((a, s) => a + s.calentamientoKg, 0);
  const total = trabajo + calentamiento;
  const maxSemana = Math.max(...semanas.map((s) => s.trabajoKg + s.calentamientoKg));
  const currentWeek = plan?.plan?.currentWeek ?? null;
  const detalle = sel != null ? semanas.find((s) => s.week === sel) : undefined;

  return (
    <div className="ho-card">
      <div className="ho-card__head"><span className="ho-card__t">Tu recorrido</span><span className="ho-card__end" style={{ color: "var(--wl-muted)" }}>kg</span></div>
      <div style={{ fontFamily: "var(--wl-display)", fontWeight: 800, fontSize: 40, lineHeight: 1, color: "var(--wl-text)", fontVariantNumeric: "tabular-nums", marginTop: 6 }}>
        {CL(total)}<span style={{ fontSize: 16, color: "var(--wl-muted)", marginLeft: 6 }}>kg</span>
      </div>
      <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--wl-muted)", marginTop: 8 }}>
        {calentamiento > 0
          ? <>trabajo {CL(trabajo)} kg · calentamiento ~{CL(calentamiento)} kg</>
          : <>trabajo {CL(trabajo)} kg</>}
      </div>
      <div style={{ fontFamily: "var(--mono)", fontSize: 10, color: "var(--wl-muted)", marginTop: 3 }}>
        {conRegistro} {conRegistro === 1 ? "semana" : "semanas"} con registro
      </div>
      <div aria-label="Kg movidos por semana" style={{ display: "flex", alignItems: "flex-end", gap: 3, height: BAR_AREA_H + TICK_ZONE_H, marginTop: 12 }}>
        {semanas.map((s) => {
          const kg = s.trabajoKg + s.calentamientoKg;
          const alto = kg > 0 ? Math.max(6, Math.round((kg / maxSemana) * BAR_AREA_H)) : 3;
          const esHoy = currentWeek != null && s.week === currentWeek;
          const esFutura = currentWeek != null && s.week > currentWeek;
          return (
            <button
              key={s.week}
              type="button"
              aria-label={`Semana ${s.week}: ${CL(kg)} kg`}
              aria-pressed={sel === s.week}
              aria-current={esHoy ? "step" : undefined}
              onClick={() => setSel((prev) => (prev === s.week ? null : s.week))}
              style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end", height: "100%", background: "none", border: "none", padding: 0, margin: 0, cursor: "pointer" }}
            >
              <span
                style={{
                  display: "block", width: "100%", height: alto, borderRadius: 2,
                  background: kg > 0 ? "var(--wl-accent)" : "color-mix(in srgb, var(--wl-text) 10%, transparent)",
                  opacity: esFutura ? FUTURE_OPACITY : 1,
                }}
              />
              {/* tick de HOY (2px var(--wl-accent)); las demás reservan la zona para no desalinear */}
              <span style={{ display: "block", width: "100%", height: 2, marginTop: 2, borderRadius: 1, background: esHoy ? "var(--wl-accent)" : "transparent" }} />
            </button>
          );
        })}
      </div>
      {detalle && (
        <div role="status" style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--wl-text)", marginTop: 6, fontVariantNumeric: "tabular-nums" }}>
          Semana {detalle.week} · {CL(detalle.trabajoKg + detalle.calentamientoKg)} kg · {detalle.sesionesHechas}/{detalle.sesionesTotales} sesiones
        </div>
      )}
      <div style={{ fontFamily: "var(--mono)", fontSize: 9.5, color: "var(--wl-muted)", marginTop: 6 }}>kg movidos por semana del plan · trabajo + calentamiento</div>
      <div style={{ fontFamily: "var(--mono)", fontSize: 9.5, color: "var(--wl-muted)", marginTop: 3 }}>Tocá una semana para ver su detalle — tu volumen real a lo largo del macro.</div>
    </div>
  );
}
