import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import type { SessionView } from "@holy-oly/core";
import { meClient, type MeClient } from "../../../data/meClient";

const doneOf = (s: SessionView) => s.exercises.filter((e) => e.actual?.done).length;

export function SemanaCard({ week, client = meClient }: { week: number; client?: MeClient }) {
  const navigate = useNavigate();
  const [sessions, setSessions] = useState<SessionView[] | null>(null);
  useEffect(() => {
    let on = true;
    client.getMeSessions(week).then((s) => { if (on) setSessions(s); }).catch(() => { if (on) setSessions([]); });
    return () => { on = false; };
  }, [client, week]);

  if (!sessions || sessions.length === 0) return null;

  const allDone = sessions.every((s) => doneOf(s) === s.exercises.length);
  // sessions is non-empty (guard above); `sessions[0]!` is always defined here.
  const next = sessions.find((s) => doneOf(s) < s.exercises.length) ?? sessions[0]!;

  return (
    <section className="ho-card">
      <div className="ho-card__head"><span className="ho-card__t">Tu semana</span></div>
      {allDone ? (
        <div className="ho-card__sub">✓ Registraste toda la semana — tocá un día para editar.</div>
      ) : (
        <>
          <button
            type="button"
            className="wl-btn wl-btn--primary"
            style={{ width: "100%", marginTop: 10 }}
            onClick={() => navigate(`/atleta/entreno/${week}/${next.sessionIdx}`)}
          >
            Registrar entreno · Día {next.sessionIdx + 1}
          </button>
          <div className="ho-card__sub">tocá un día para registrar tu entreno</div>
        </>
      )}
      <div style={{ display: "flex", flexDirection: "column", gap: 7, marginTop: 10 }}>
        {sessions.map((s) => {
          const total = s.exercises.length;
          const done = doneOf(s);
          const state = done === 0 ? "pendiente" : done === total ? "hecho" : "en curso";
          const dot = state === "hecho" ? "var(--wl-accent)" : state === "en curso" ? "var(--wl-muted)" : "color-mix(in srgb,var(--wl-text) 22%,transparent)";
          return (
            <button key={s.sessionIdx} type="button" aria-label={`Día ${s.sessionIdx + 1}`} onClick={() => navigate(`/atleta/entreno/${week}/${s.sessionIdx}`)}
              style={{ display: "flex", alignItems: "center", gap: 10, width: "100%", textAlign: "left", padding: "10px 12px", borderRadius: "var(--wl-radius)", border: "1px solid color-mix(in srgb,var(--wl-text) 10%,transparent)", background: "var(--wl-bg)", cursor: "pointer" }}>
              <span style={{ width: 9, height: 9, borderRadius: 99, background: dot, flex: "0 0 auto" }} />
              <span style={{ flex: 1, fontFamily: "var(--wl-display)", fontWeight: 700, fontSize: 14, color: "var(--wl-text)" }}>Día {s.sessionIdx + 1}</span>
              <span style={{ fontFamily: "var(--mono)", fontSize: 10.5, color: "var(--wl-muted)" }}>{done}/{total} · {state}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
