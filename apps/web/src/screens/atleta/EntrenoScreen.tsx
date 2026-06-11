import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { SessionView, ExerciseActualInput, MePlanView } from "@holy-oly/core";
import { getMovement, barKgForSexo } from "@holy-oly/core";
import * as me from "../../data/meClient";
import { BackButton } from "../../ui/BackButton";
import { SubstituteSheet } from "../../ui/SubstituteSheet";
import { ResumenDia } from "./entreno/ResumenDia";
import { SessionPlayer, type PlayerRow } from "./entreno/SessionPlayer";
import type { SetRow } from "./entreno/WorkSetsSection";

export function EntrenoScreen() {
  const { week: weekP, idx: idxP } = useParams();
  const navigate = useNavigate();
  const week = Number(weekP);
  const idx = Number(idxP);
  const [rows, setRows] = useState<PlayerRow[] | null>(null);
  const [barKg, setBarKg] = useState(20);
  const [started, setStarted] = useState(false);
  const [cur, setCur] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [subOpen, setSubOpen] = useState(false);
  // Error de carga ≠ día vacío (D5): un fallo de API no puede disfrazarse de "no hay sesión".
  const [loadError, setLoadError] = useState(false);
  const [reload, setReload] = useState(0);

  useEffect(() => {
    if (!Number.isInteger(week) || !Number.isInteger(idx)) { navigate("/atleta", { replace: true }); return; }
    let on = true;
    setRows(null); setLoadError(false);
    // D5: si el plan falla, el rechazo cae al catch general (loadError) — nada de degradar en
    // silencio a barra de 20 kg. El plan null RESUELTO (sin plan asignado) sigue siendo legítimo.
    Promise.all([me.getMePlan(), me.getMeSessions(week)])
      .then(([plan, views]: [MePlanView, SessionView[]]) => {
        if (!on) return;
        setBarKg(barKgForSexo(plan.athlete.sexo));
        const s = views.find((v) => v.sessionIdx === idx);
        setRows((s?.exercises ?? []).map((e) => {
          const fromActual = e.actual?.sets;
          const series: SetRow[] = fromActual && fromActual.length > 0
            ? fromActual.map((x) => ({ kg: x.kg, reps: x.reps, done: x.done }))
            : Array.from({ length: e.sets }, () => ({ kg: e.targetKg, reps: e.reps, done: true }));
          return {
            movementId: e.actual?.movementId ?? e.movementId,
            movementName: e.actual?.movementName ?? e.movementName,
            prescribedMovementId: e.movementId,
            sets: e.sets, reps: e.reps, targetKg: e.targetKg, pct: e.pct, notes: e.notes,
            warmup: e.warmup ?? [],
            series,
          };
        }));
      })
      .catch(() => { if (on) { setRows([]); setLoadError(true); } });
    return () => { on = false; };
  }, [week, idx, navigate, reload]);

  const patchSet = (setIdx: number, p: Partial<SetRow>): void =>
    setRows((rs) => rs ? rs.map((r, j) => j === cur ? { ...r, series: r.series.map((s, k) => k === setIdx ? { ...s, ...p } : s) } : r) : rs);

  const movementNotDone = (): void =>
    setRows((rs) => rs ? rs.map((r, j) => j === cur ? { ...r, series: r.series.map((s) => ({ ...s, done: false })) } : r) : rs);

  const pickSub = (id: string): void =>
    setRows((rs) => rs ? rs.map((r, j) => j === cur ? { ...r, movementId: id, movementName: getMovement(id)?.name ?? id, series: r.series.map((s) => ({ ...s, kg: undefined })) } : r) : rs);

  const save = useCallback(async () => {
    if (!rows) return;
    setBusy(true); setError(null);
    try {
      const actuals: ExerciseActualInput[] = rows.map((r, order) => {
        const sets = r.series.map((s) => ({ kg: s.kg, reps: s.reps, done: s.done }));
        return { order, movementId: r.movementId, prescribedMovementId: r.prescribedMovementId, done: sets.some((s) => s.done), sets };
      });
      await me.putMeSession(week, idx, actuals);
      navigate(`/atleta/entreno/${week}/${idx}/victoria`);
    } catch (e) { setError(e instanceof Error ? e.message : "No se pudo guardar"); }
    finally { setBusy(false); }
  }, [rows, week, idx, navigate]);

  if (rows === null) return <div style={{ padding: 20, color: "var(--wl-muted)", fontFamily: "var(--mono)" }}>Cargando…</div>;

  // NOTE: rendered inside AthleteShell's `<main className="ho-scroll">` — no agregar otro wrapper ho-scroll.
  return (
    <div>
      <BackButton ariaLabel="Volver" onClick={() => (started ? setStarted(false) : navigate("/atleta"))} style={{ marginBottom: 6 }} />
      <div style={{ fontFamily: "var(--wl-display)", fontWeight: 800, fontSize: 20, color: "var(--wl-text)" }}>Entreno · sem {week} · día {idx + 1}</div>

      {loadError ? (
        <div role="alert" style={{ marginTop: 14, fontFamily: "var(--mono)", fontSize: 11, color: "var(--wl-danger)" }}>
          No se pudo cargar la sesión.{" "}
          <button type="button" onClick={() => setReload((r) => r + 1)}
            style={{ border: 0, background: "transparent", color: "var(--wl-accent)", fontFamily: "var(--mono)", fontSize: 11, cursor: "pointer", textDecoration: "underline", padding: 0 }}>
            Reintentar
          </button>
        </div>
      ) : rows.length === 0 ? (
        <div style={{ marginTop: 14, fontFamily: "var(--mono)", fontSize: 11, color: "var(--wl-muted)" }}>No hay sesión para este día.</div>
      ) : !started ? (
        <div style={{ marginTop: 12 }}>
          <ResumenDia
            rows={rows.map((r) => ({ movementName: r.movementName, sets: r.sets, reps: r.reps, kg: r.series[0]?.kg ?? r.targetKg }))}
            barKg={barKg}
            onStart={() => { setCur(0); setStarted(true); }}
          />
        </div>
      ) : (
        <div style={{ marginTop: 12 }}>
          <SessionPlayer
            row={rows[cur]!} index={cur} total={rows.length} barKg={barKg} busy={busy}
            onPatchSet={patchSet}
            onSubstitute={() => setSubOpen(true)}
            onMovementNotDone={movementNotDone}
            onPrev={() => setCur((c) => Math.max(0, c - 1))}
            onNext={() => setCur((c) => Math.min(rows.length - 1, c + 1))}
            onFinish={() => void save()}
          />
          {error && <div role="alert" style={{ marginTop: 10, color: "var(--wl-danger)", fontFamily: "var(--mono)", fontSize: 11 }}>{error}</div>}
        </div>
      )}

      {subOpen && rows[cur] && (
        <SubstituteSheet open movementId={rows[cur]!.movementId} onClose={() => setSubOpen(false)} onPick={pickSub} />
      )}
    </div>
  );
}
