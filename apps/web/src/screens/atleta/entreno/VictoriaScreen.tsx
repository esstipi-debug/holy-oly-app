import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { MePlanView, SessionView } from "@holy-oly/core";
import { barKgForSexo, sessionTonnage, heaviestSet, completion } from "@holy-oly/core";
import * as me from "../../../data/meClient";
import { DiscRow } from "../../../ui/Disc";
import { CaminoCard } from "../hoy/CaminoCard";

const CL = (n: number): string => n.toLocaleString("es-CL");

type LoadState = "loading" | "ready" | "error";

/** A4 · pantalla de victoria tras guardar un entreno. Re-lee la sesión guardada y muestra
 *  tonelaje del día, serie más pesada (discos oficiales), cumplimiento y posición en el macro.
 *  Titular adaptativo: 0 ejercicios hechos → «Sesión registrada» sin tarjetas de carga. */
export function VictoriaScreen() {
  const { week: weekP, idx: idxP } = useParams();
  const navigate = useNavigate();
  const week = Number(weekP);
  const idx = Number(idxP);

  const [plan, setPlan] = useState<MePlanView | null>(null);
  const [session, setSession] = useState<SessionView | undefined>(undefined);
  const [sessionsCount, setSessionsCount] = useState(0);
  const [state, setState] = useState<LoadState>("loading");

  useEffect(() => {
    if (!Number.isInteger(week) || !Number.isInteger(idx)) { navigate("/atleta", { replace: true }); return; }
    let on = true;
    Promise.all([me.getMePlan(), me.getMeSessions(week)])
      .then(([p, views]: [MePlanView, SessionView[]]) => {
        if (!on) return;
        const s = views.find((v) => v.sessionIdx === idx);
        if (!s) { setState("error"); return; }
        setPlan(p); setSession(s); setSessionsCount(views.length); setState("ready");
      })
      .catch(() => { if (on) setState("error"); });
    return () => { on = false; };
  }, [week, idx, navigate]);

  if (state === "loading") {
    return <div style={{ padding: 20, color: "var(--wl-muted)", fontFamily: "var(--ho-mono)" }}>Cargando…</div>;
  }
  if (state === "error" || !session || !plan) {
    return (
      <div style={{ padding: 20 }}>
        <div style={{ fontFamily: "var(--wl-display)", fontWeight: 800, fontSize: 18, color: "var(--wl-text)" }}>No pudimos cargar el resumen</div>
        <button type="button" className="wl-btn wl-btn--primary" style={{ width: "100%", marginTop: 14 }} onClick={() => navigate("/atleta")}>Volver al inicio</button>
      </div>
    );
  }

  const exercises = session.exercises;
  const barKg = barKgForSexo(plan.athlete.sexo);
  const comp = completion(exercises);
  const didWork = comp.done > 0;
  const tonnage = sessionTonnage(exercises);
  const heaviest = heaviestSet(exercises);
  const title = didWork ? "Sesión completada" : "Sesión registrada";
  const dayMoves = exercises.slice(0, 2).map((e) => e.actual?.movementName ?? e.movementName).join(" + ");
  const fecha = new Date().toLocaleDateString("es-CL", { weekday: "long", day: "numeric", month: "long" });

  const muteFill = "color-mix(in srgb, var(--wl-text) 12%, transparent)";

  return (
    <div>
      {/* header */}
      <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "var(--ho-mono)", fontSize: 10.5, letterSpacing: ".16em", textTransform: "uppercase", color: "var(--wl-muted)" }}>
        <span>Holy Oly · Sesión</span>
        {plan.plan?.currentPhase && <span style={{ color: "var(--wl-accent)" }}>{plan.plan.currentPhase}</span>}
      </div>
      <div style={{ fontFamily: "var(--wl-display)", fontWeight: 800, fontSize: 30, lineHeight: 1, textTransform: "uppercase", color: "var(--wl-text)", marginTop: 8 }}>{title}</div>
      <div style={{ fontFamily: "var(--ho-mono)", fontSize: 11, color: "var(--wl-muted)", marginTop: 8, lineHeight: 1.5 }}>Día {idx + 1} — {dayMoves}<br />{fecha}</div>

      {/* carga total del día */}
      {didWork && (
        <div className="ho-card">
          <div className="ho-card__head"><span className="ho-card__t">Carga total del día</span><span className="ho-card__end" style={{ color: "var(--wl-muted)" }}>kg</span></div>
          <div style={{ fontFamily: "var(--wl-display)", fontWeight: 800, fontSize: 48, lineHeight: 1, color: "var(--wl-text)", fontVariantNumeric: "tabular-nums", marginTop: 6 }}>
            {CL(tonnage)}<span style={{ fontSize: 18, color: "var(--wl-muted)", marginLeft: 6 }}>kg</span>
          </div>
          <div style={{ fontFamily: "var(--ho-mono)", fontSize: 10, color: "var(--wl-muted)", marginTop: 8 }}>Tonelaje movido en la sesión · el calentamiento no cuenta</div>
        </div>
      )}

      {/* serie más pesada + discos oficiales */}
      {didWork && heaviest && (
        <div className="ho-card">
          <div className="ho-card__head"><span className="ho-card__t">Tu serie más pesada hoy</span></div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 10, marginTop: 4 }}>
            <span style={{ fontFamily: "var(--wl-display)", fontWeight: 700, fontSize: 18, color: "var(--wl-text)" }}>{heaviest.movementName}</span>
            <span style={{ fontFamily: "var(--wl-display)", fontWeight: 800, fontSize: 24, color: "var(--wl-text)", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{heaviest.kg}<span style={{ fontSize: 13, color: "var(--wl-muted)" }}> kg</span></span>
          </div>
          <div style={{ marginTop: 12 }}><DiscRow kg={heaviest.kg} barKg={barKg} /></div>
          <div style={{ fontFamily: "var(--ho-mono)", fontSize: 9.5, color: "var(--wl-muted)", marginTop: 10 }}>Discos IWF por lado · aproximan al kg</div>
        </div>
      )}

      {/* cumplimiento */}
      <div className="ho-card">
        <div className="ho-card__head"><span className="ho-card__t">Cumplimiento</span></div>
        <div style={{ display: "flex", gap: 16, marginTop: 8 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: "var(--ho-mono)", fontWeight: 700, fontSize: 20, color: "var(--wl-text)" }}>{comp.done}/{comp.total}</div>
            <div style={{ fontFamily: "var(--ho-mono)", fontSize: 10, color: "var(--wl-muted)", marginTop: 3 }}>ejercicios completados</div>
            <div style={{ display: "flex", gap: 4, marginTop: 8 }}>
              {Array.from({ length: comp.total }).map((_, i) => (
                <div key={i} style={{ height: 5, flex: 1, borderRadius: 2, background: i < comp.done ? "var(--ok)" : muteFill }} />
              ))}
            </div>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontFamily: "var(--ho-mono)", fontWeight: 700, fontSize: 20, color: "var(--wl-text)" }}>{idx + 1} / {sessionsCount}</div>
            <div style={{ fontFamily: "var(--ho-mono)", fontSize: 10, color: "var(--wl-muted)", marginTop: 3 }}>sesión de la semana</div>
          </div>
        </div>
      </div>

      {/* posición en el macro — reuso del componente existente */}
      <CaminoCard plan={plan.plan} />

      {/* CTAs */}
      <button type="button" className="wl-btn wl-btn--primary" style={{ width: "100%", marginTop: 16 }} onClick={() => navigate("/atleta")}>Listo</button>
      <button type="button" className="wl-btn" style={{ width: "100%", marginTop: 10 }} onClick={() => navigate("/atleta")}>Registrar bienestar</button>
    </div>
  );
}
