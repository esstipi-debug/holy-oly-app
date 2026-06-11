import { useEffect, useState } from "react";
import type { MeRecorrido } from "@holy-oly/core";
import { meClient, type MeClient } from "../../data/meClient";

const CL = (n: number): string => n.toLocaleString("es-CL");

type Load = "loading" | "ready" | "error";

const BAR_AREA_H = 44; // alto del área de barras (px); la semana máxima llena el área

/**
 * «Tu recorrido» (recorrido D1, altura macro): lo HECHO acumulado del plan — total grande,
 * desglose trabajo/calentamiento (regla 06-11: la rampa es volumen visible, jamás del monitor)
 * y barras por semana sin charts nuevos (divs, alto ∝ kg). Sólo carga PROPIA en kg (HR-1).
 * Recorrido vacío → no renderiza nada (sin culpa). Error → alert + Reintentar (patrón D5).
 */
export function RecorridoCard({ client = meClient }: { client?: MeClient } = {}) {
  const [recorrido, setRecorrido] = useState<MeRecorrido | null>(null);
  const [load, setLoad] = useState<Load>("loading");
  const [stamp, setStamp] = useState(0); // Reintentar re-dispara el load vía stamp (mantiene la cancelación del effect)

  useEffect(() => {
    let on = true;
    setLoad("loading");
    client.getMeRecorrido()
      .then((r) => { if (on) { setRecorrido(r); setLoad("ready"); } })
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
      <div aria-label="Kg movidos por semana" style={{ display: "flex", alignItems: "flex-end", gap: 3, height: BAR_AREA_H, marginTop: 12 }}>
        {semanas.map((s) => {
          const kg = s.trabajoKg + s.calentamientoKg;
          const alto = kg > 0 ? Math.max(6, Math.round((kg / maxSemana) * BAR_AREA_H)) : 3;
          return (
            <div
              key={s.week}
              title={`S${s.week} · ${CL(kg)} kg`}
              style={{ flex: 1, height: alto, borderRadius: 2, background: kg > 0 ? "var(--wl-accent)" : "color-mix(in srgb, var(--wl-text) 10%, transparent)" }}
            />
          );
        })}
      </div>
      <div style={{ fontFamily: "var(--mono)", fontSize: 9.5, color: "var(--wl-muted)", marginTop: 6 }}>kg movidos por semana del plan · trabajo + calentamiento</div>
    </div>
  );
}
