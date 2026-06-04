import { useCallback, useEffect, useState, type CSSProperties } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { SessionView, ExerciseActualInput } from "@holy-oly/core";
import { getMovement, barKgForSexo } from "@holy-oly/core";
import * as me from "../../data/meClient";
import { DiscRow } from "../../ui/Disc";
import { SubstituteSheet } from "../../ui/SubstituteSheet";

interface Row {
  movementId: string; movementName: string; prescribedMovementId: string;
  sets: number; reps: number; targetKg?: number;
  open: boolean; notDone: boolean;
  kg?: number; repsActual?: number; note?: string;
}

const num: CSSProperties = { width: 70, boxSizing: "border-box", padding: "7px 8px", borderRadius: 9, textAlign: "center", border: "1px solid color-mix(in srgb,var(--wl-text) 16%,transparent)", background: "var(--wl-bg)", color: "var(--wl-text)", fontFamily: "var(--wl-display)", fontSize: 15 };
const chip: CSSProperties = { border: "1px solid color-mix(in srgb,var(--wl-text) 16%,transparent)", borderRadius: 999, background: "var(--wl-bg)", color: "var(--wl-text)", fontFamily: "var(--wl-display)", fontWeight: 700, fontSize: 12.5, padding: "6px 11px", cursor: "pointer" };

export function EntrenoScreen() {
  const { week: weekP, idx: idxP } = useParams();
  const navigate = useNavigate();
  const week = Number(weekP);
  const idx = Number(idxP);
  const [rows, setRows] = useState<Row[] | null>(null);
  const [barKg, setBarKg] = useState(20);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [subFor, setSubFor] = useState<number | null>(null);

  useEffect(() => {
    if (!Number.isInteger(week) || !Number.isInteger(idx)) { navigate("/atleta", { replace: true }); return; }
    let on = true;
    Promise.all([me.getMePlan().catch(() => null), me.getMeSessions(week)])
      .then(([plan, views]: [{ athlete: { sexo: "M" | "F" } } | null, SessionView[]]) => {
        if (!on) return;
        setBarKg(barKgForSexo(plan?.athlete.sexo ?? "M"));
        const s = views.find((v) => v.sessionIdx === idx);
        setRows((s?.exercises ?? []).map((e) => ({
          movementId: e.actual?.movementId ?? e.movementId,
          movementName: e.actual?.movementName ?? e.movementName,
          prescribedMovementId: e.movementId,
          sets: e.sets, reps: e.reps, targetKg: e.targetKg,
          open: false, notDone: e.actual ? !e.actual.done : false,
          kg: e.actual?.kg ?? e.targetKg, repsActual: e.actual?.reps ?? e.reps, note: e.actual?.note ?? "",
        })));
      })
      .catch(() => { if (on) setRows([]); });
    return () => { on = false; };
  }, [week, idx, navigate]);

  const patch = (i: number, p: Partial<Row>): void => setRows((rs) => (rs ? rs.map((r, j) => (j === i ? { ...r, ...p } : r)) : rs));

  const save = useCallback(async () => {
    if (!rows) return;
    setBusy(true); setError(null);
    try {
      const actuals: ExerciseActualInput[] = rows.map((r, order) =>
        r.notDone
          ? { order, movementId: r.movementId, prescribedMovementId: r.prescribedMovementId, done: false }
          : { order, movementId: r.movementId, prescribedMovementId: r.prescribedMovementId, done: true,
              kg: r.kg, reps: r.repsActual, note: r.note?.trim() ? r.note.trim() : undefined });
      await me.putMeSession(week, idx, actuals);
      navigate("/atleta");
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo guardar"); }
    finally { setBusy(false); }
  }, [rows, week, idx, navigate]);

  if (rows === null) return <div style={{ padding: 20, color: "var(--wl-muted)", fontFamily: "var(--ho-mono)" }}>Cargando…</div>;

  // NOTE: rendered inside AthleteShell's `<main className="ho-scroll">` (child route) — do NOT add
  // another `ho-scroll` wrapper here (the shell already provides scroll padding incl. nav clearance).
  return (
    <div>
      <button type="button" aria-label="volver" onClick={() => navigate("/atleta")} style={{ border: 0, background: "transparent", color: "var(--wl-text)", fontSize: 22, cursor: "pointer", padding: 0, marginBottom: 6 }}>‹</button>
      <div style={{ fontFamily: "var(--wl-display)", fontWeight: 800, fontSize: 20, color: "var(--wl-text)" }}>Entreno · sem {week} · día {idx + 1}</div>
      <div style={{ fontFamily: "var(--ho-mono)", fontSize: 11, color: "var(--wl-muted)", marginTop: 2 }}>Hacé lo prescrito. Tocá "modificar" sólo si cambió algo.</div>

      <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 14 }}>
        {rows.map((r, i) => (
          <div key={i} style={{ background: "var(--wl-surface)", borderRadius: 12, padding: "11px 13px", opacity: r.notDone ? 0.6 : 1 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
              <span style={{ fontFamily: "var(--wl-display)", fontWeight: 800, fontSize: 16, color: "var(--wl-text)" }}>{r.movementName}</span>
              <span style={{ fontFamily: "var(--wl-display)", fontWeight: 800, fontSize: 22, color: "var(--wl-text)" }}>{r.kg != null ? `${r.kg}` : "—"}<span style={{ fontSize: 12, color: "var(--wl-muted)", fontWeight: 600 }}> kg</span></span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 8, marginTop: 8 }}>
              {r.kg != null ? <DiscRow kg={r.kg} barKg={barKg} /> : <span />}
              <span style={{ fontFamily: "var(--wl-display)", fontSize: 13, color: "var(--wl-muted)" }}>{r.sets} series × {r.reps} repeticiones</span>
            </div>
            {r.movementId !== r.prescribedMovementId && (
              <div style={{ fontFamily: "var(--wl-display)", fontSize: 11, color: "var(--wl-muted)", marginTop: 4 }}>prescripto: {getMovement(r.prescribedMovementId)?.name ?? r.prescribedMovementId}</div>
            )}
            {r.notDone && <div style={{ fontFamily: "var(--wl-display)", fontSize: 12, color: "var(--wl-muted)", marginTop: 4 }}>no la hice</div>}
            {!r.open ? (
              <button type="button" onClick={() => patch(i, { open: true })} style={{ marginTop: 9, border: 0, background: "transparent", color: "var(--wl-accent)", fontFamily: "var(--wl-display)", fontWeight: 700, fontSize: 13, cursor: "pointer", padding: 0 }} aria-label={`modificar ${r.movementName}`}>✎ modificar</button>
            ) : (
              <div style={{ marginTop: 10 }}>
                <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
                  <input style={num} type="number" inputMode="decimal" aria-label={`kg real de ${r.movementName}`} value={r.kg ?? ""} onChange={(e) => patch(i, { kg: e.target.value ? Number(e.target.value) : undefined })} /><span style={{ color: "var(--wl-muted)", fontSize: 12 }}>kg</span>
                  <input style={num} type="number" inputMode="numeric" aria-label={`reps reales de ${r.movementName}`} value={r.repsActual ?? ""} onChange={(e) => patch(i, { repsActual: e.target.value === "" ? undefined : Number(e.target.value) })} /><span style={{ color: "var(--wl-muted)", fontSize: 12 }}>reps</span>
                </div>
                <div style={{ display: "flex", gap: 8, marginTop: 9, flexWrap: "wrap" }}>
                  <button type="button" style={chip} onClick={() => setSubFor(i)} aria-label={`cambiar movimiento de ${r.movementName}`}>⇄ cambiar</button>
                  <button type="button" style={chip} onClick={() => patch(i, { notDone: !r.notDone })}>{r.notDone ? "sí la hice" : "no la hice"}</button>
                  <button type="button" style={chip} onClick={() => patch(i, { open: false })}>✓ listo</button>
                </div>
              </div>
            )}
            <input style={{ ...num, width: "100%", textAlign: "left", marginTop: 8 }} type="text" maxLength={200} aria-label={`nota de ${r.movementName}`} placeholder="nota (opcional)" value={r.note ?? ""} onChange={(e) => patch(i, { note: e.target.value })} />
          </div>
        ))}
        {rows.length === 0 && <div style={{ fontFamily: "var(--ho-mono)", fontSize: 11, color: "var(--wl-muted)" }}>No hay sesión para este día.</div>}
      </div>

      {error && <div role="alert" style={{ marginTop: 10, color: "#ff3b46", fontFamily: "var(--ho-mono)", fontSize: 11 }}>{error}</div>}
      {rows.length > 0 && (
        <button type="button" className="wl-btn wl-btn--primary" disabled={busy} onClick={() => void save()} style={{ width: "100%", marginTop: 16, opacity: busy ? 0.6 : 1 }}>{busy ? "Guardando…" : "Listo · Guardar entreno"}</button>
      )}
      {subFor !== null && rows[subFor] && (
        <SubstituteSheet open movementId={rows[subFor]!.movementId} onClose={() => setSubFor(null)}
          onPick={(id) => patch(subFor, { movementId: id, movementName: getMovement(id)?.name ?? id, kg: undefined })} />
      )}
    </div>
  );
}
