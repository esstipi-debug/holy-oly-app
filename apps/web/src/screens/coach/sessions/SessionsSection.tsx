import { useCallback, useEffect, useState, type CSSProperties } from "react";
import type { PrescribedExercise, SessionView } from "@holy-oly/core";
import { kgDeviation } from "@holy-oly/core";
import { useRepository } from "../../../data/RepositoryProvider";
import { SessionEditor } from "./SessionEditor";

const sec: CSSProperties = { fontFamily: "var(--wl-display)", fontSize: 11, letterSpacing: ".16em", textTransform: "uppercase", color: "var(--wl-muted)", margin: "22px 0 10px" };
const card: CSSProperties = { background: "var(--wl-surface)", borderRadius: "var(--wl-radius)", padding: "10px 12px", marginTop: 8 };
const noteStyle: CSSProperties = { fontFamily: "var(--mono)", fontSize: 10, color: "var(--wl-muted)", marginTop: 2, fontStyle: "italic" };

const DEVIATION_MARKER: Record<"none" | "igual" | "mas" | "menos", string> = {
  none: "",
  igual: "=",
  mas: "↑",
  menos: "↓",
};

function load(targetKg: number | undefined, rpe: number | undefined): string {
  return targetKg != null ? `${targetKg} kg` : rpe != null ? `RPE ${rpe}` : "—";
}

export function SessionsSection({ athleteId, hoyWeek, totalWeeks }: { athleteId: string; hoyWeek: number; totalWeeks: number }) {
  const repo = useRepository();
  const [week, setWeek] = useState(Math.min(Math.max(hoyWeek, 1), totalWeeks));
  const [sessions, setSessions] = useState<SessionView[] | null>(null);
  const [editing, setEditing] = useState<SessionView | null>(null);

  const refresh = useCallback(() => { repo.getPrescriptionWeek(athleteId, week).then(setSessions).catch(() => setSessions([])); }, [repo, athleteId, week]);
  useEffect(() => { setSessions(null); refresh(); }, [refresh]);

  const onSave = useCallback(async (exercises: PrescribedExercise[]) => {
    if (!editing) return;
    await repo.setSession(athleteId, editing.week, editing.sessionIdx, exercises);
    setEditing(null);
    refresh();
  }, [repo, athleteId, editing, refresh]);

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={sec}>Sesiones</div>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontFamily: "var(--mono)", fontSize: 11, color: "var(--wl-muted)" }}>
          <button type="button" aria-label="semana anterior" onClick={() => setWeek((w) => Math.max(1, w - 1))} style={{ border: 0, background: "transparent", color: "var(--wl-text)", cursor: "pointer", fontSize: 16 }}>‹</button>
          Sem {week}
          <button type="button" aria-label="semana siguiente" onClick={() => setWeek((w) => Math.min(totalWeeks, w + 1))} style={{ border: 0, background: "transparent", color: "var(--wl-text)", cursor: "pointer", fontSize: 16 }}>›</button>
        </div>
      </div>
      {sessions === null ? (
        <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--wl-muted)" }}>Cargando…</div>
      ) : sessions.length === 0 ? (
        <div style={{ fontFamily: "var(--mono)", fontSize: 11, color: "var(--wl-muted)" }}>Sin sesiones para esta semana (asigná un macro con receta o armalas a mano).</div>
      ) : (
        sessions.map((s) => (
          <div key={s.sessionIdx} style={card}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span style={{ fontFamily: "var(--wl-display)", fontWeight: 700, fontSize: 13, color: "var(--wl-text)" }}>Día {s.sessionIdx + 1}</span>
              <button type="button" aria-label={`editar sesión día ${s.sessionIdx + 1}`} onClick={() => setEditing(s)} style={{ border: 0, background: "transparent", color: "var(--wl-accent)", cursor: "pointer", fontFamily: "var(--mono)", fontSize: 11 }}>editar ›</button>
            </div>
            {s.exercises.map((e, i) => {
              const dev = e.actual?.done ? kgDeviation(e.targetKg, e.actual.kg) : "none";
              const marker = DEVIATION_MARKER[dev];
              return (
                <div key={i} style={{ marginTop: 4 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontFamily: "var(--mono)", fontSize: 11, color: "var(--wl-muted)" }}>
                    <span style={{ color: "var(--wl-text)" }}>{e.movementName}</span>
                    <span>
                      {e.sets}×{e.reps} · {load(e.targetKg, e.rpe)}
                      {e.actual?.done && e.actual.kg != null && (<> · real {e.actual.kg} kg {marker}</>)}
                      {e.actual && !e.actual.done && (<> · no hecho</>)}
                    </span>
                  </div>
                  {e.actual?.note && (
                    <div style={noteStyle}>📝 {e.actual.note}</div>
                  )}
                </div>
              );
            })}
          </div>
        ))
      )}
      {editing && (
        <SessionEditor open week={editing.week} sessionIdx={editing.sessionIdx} exercises={editing.exercises} onClose={() => setEditing(null)} onSave={onSave} />
      )}
    </div>
  );
}
