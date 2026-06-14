import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { SessionView } from "@holy-oly/core";
import { weekDoneSummary, sessionsByDay, priorDaysResolved } from "@holy-oly/core";
import { meClient, type MeClient } from "../../../data/meClient";

const doneOf = (s: SessionView) => s.exercises.filter((e) => e.actual?.done).length;
// Secuencia de días: resuelto = anulado o registrado (con fecha) — espejo EXACTO del backend
// (un registro existe ⇔ la sesión es hecho/anulado; completar siempre crea el registro con su fecha).
const isResolved = (s: SessionView) => s.anulado === true || s.fecha != null;

const labelOf = (s: SessionView) => {
  const day = s.day ?? s.sessionIdx + 1;
  return s.turno ? `Día ${day} · ${s.turno}` : `Día ${day}`;
};

export function SemanaCard({ week, client = meClient }: { week: number; client?: MeClient }) {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<SessionView[] | null>(null);
  useEffect(() => {
    let on = true;
    client.getMeSessions(week).then((s) => { if (on) setSessions(s); }).catch(() => { if (on) setSessions([]); });
    return () => { on = false; };
  }, [client, week]);

  if (!sessions || sessions.length === 0) return null;

  // Secuencia de días (2026-06-13): un día pendiente está BLOQUEADO si algún día anterior de la
  // semana no está resuelto. Los días resueltos (hechos/anulados) siempre se pueden tocar (editar).
  const allIdxs = sessions.map((s) => s.sessionIdx);
  const dayOf = (i: number): number => sessions.find((s) => s.sessionIdx === i)?.day ?? i + 1;
  const resolvedSet = new Set(sessions.filter(isResolved).map((s) => s.sessionIdx));
  const isLocked = (s: SessionView): boolean =>
    !resolvedSet.has(s.sessionIdx) && !priorDaysResolved(allIdxs, (i) => resolvedSet.has(i), dayOf, s.sessionIdx);

  const allDone = sessions.every(isResolved);
  // Primer día accionable: pendiente y desbloqueado (los días en orden). null si no hay.
  const next = sessions.find((s) => !isResolved(s) && !isLocked(s));
  // Micro de la semana (recorrido D1): se computa client-side con las views que YA viajan —
  // cero fetch extra. Sólo si hay kg movidos (0 → nada, sin culpa).
  const resumen = weekDoneSummary(sessions);

  return (
    <section className="ho-card">
      <div className="ho-card__head"><span className="ho-card__t">Tu semana</span></div>
      {allDone ? (
        <div className="ho-card__sub">✓ Registraste toda la semana — tocá un día para editar.</div>
      ) : next ? (
        <>
          <button
            type="button"
            className="wl-btn wl-btn--primary"
            style={{ width: "100%", marginTop: 10 }}
            onClick={() => navigate(`/atleta/entreno/${week}/${next.sessionIdx}`)}
          >
            Registrar entreno · {labelOf(next)}
          </button>
          <div className="ho-card__sub">tocá un día para registrar tu entreno</div>
        </>
      ) : (
        <div className="ho-card__sub">Completá los días en orden para seguir.</div>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 7, marginTop: 10 }}>
        {sessionsByDay(sessions).flatMap((g) => g.sesiones).map(({ session: s }) => {
          const total = s.exercises.length;
          const done = doneOf(s);
          const locked = isLocked(s);
          const state = s.anulado ? "anulado" : done === 0 ? "pendiente" : done === total ? "hecho" : "en curso";
          const dot = state === "hecho" ? "var(--wl-accent)"
            : state === "anulado" ? "color-mix(in srgb,var(--wl-text) 30%,transparent)"
            : state === "en curso" ? "var(--wl-muted)"
            : "color-mix(in srgb,var(--wl-text) 22%,transparent)";
          const meta = locked ? "🔒 completá el día anterior"
            : state === "anulado" ? "anulado"
            : state === "hecho" && s.fecha ? `${done}/${total} · hecho · ${s.fecha}`
            : `${done}/${total} · ${state}`;
          return (
            <button key={s.sessionIdx} type="button" aria-label={labelOf(s)} disabled={locked}
              onClick={() => navigate(`/atleta/entreno/${week}/${s.sessionIdx}`)}
              style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left", padding: "10px 12px", borderRadius: "var(--wl-radius)", border: "1px solid color-mix(in srgb,var(--wl-text) 10%,transparent)", background: "var(--wl-bg)", cursor: locked ? "not-allowed" : "pointer", opacity: locked ? 0.55 : 1 }}>
              <span style={{ width: 9, height: 9, borderRadius: 99, background: dot, flex: "0 0 auto" }} />
              <span style={{ flex: 1, fontFamily: "var(--wl-display)", fontWeight: 700, fontSize: 14, color: "var(--wl-text)", ...(state === "anulado" ? { textDecoration: "line-through", color: "var(--wl-muted)" } : {}) }}>{labelOf(s)}</span>
              <span style={{ fontFamily: "var(--mono)", fontSize: 10.5, color: "var(--wl-muted)" }}>{meta}</span>
            </button>
          );
        })}
      </div>
      {resumen.totalKg > 0 && (
        <div style={{ fontFamily: "var(--mono)", fontSize: 10.5, color: "var(--wl-muted)", marginTop: 10, fontVariantNumeric: "tabular-nums" }}>
          {/* «~» cuando el total incluye calentamiento: la rampa es ESTIMADA (prescrita, no registrada) — regla 06-11 */}
          Esta semana: {resumen.calentamientoKg > 0 ? "~" : ""}{resumen.totalKg.toLocaleString("es-CL")} kg · {resumen.sesionesHechas}/{resumen.sesionesTotales} sesiones
        </div>
      )}
    </section>
  );
}
