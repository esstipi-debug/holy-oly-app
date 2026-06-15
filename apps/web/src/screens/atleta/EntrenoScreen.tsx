import { useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import type { SessionView, ExerciseActualInput, MePlanView } from "@holy-oly/core";
import { getMovement, barKgForSexo, fueraDeSemana, priorDaysResolved } from "@holy-oly/core";
import * as me from "../../data/meClient";
import { FechaOcupadaError, DiaBloqueadoError } from "../../data/meClient";
import { BackButton } from "../../ui/BackButton";
import { SubstituteSheet } from "../../ui/SubstituteSheet";
import { RetryButton } from "../../ui/RetryButton";
import { FechaSheet } from "./entreno/FechaSheet";
import { ResumenDia } from "./entreno/ResumenDia";
import { SessionAccordion, type PlayerRow } from "./entreno/SessionAccordion";
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
  // HOY al montar (fix T14): evita que si la app queda abierta pasando medianoche, HOY sea ayer.
  // mount-stable: el mismo componente usa la misma fecha para toda su vida.
  const [hoy] = useState(() => new Date().toISOString().slice(0, 10));
  // ── Fecha del entreno (spec 2026-06-12 D5/D12). `fecha` null = sin resolver; al guardar cae a hoy.
  const [fecha, setFecha] = useState<string | null>(null);
  const [fechaSheet, setFechaSheet] = useState<"conflicto" | "editar" | null>(null);
  const [ocupadas, setOcupadas] = useState<string[]>([]);
  const [myDay, setMyDay] = useState(idx + 1);
  const [myTurno, setMyTurno] = useState<"AM" | "PM" | undefined>(undefined);
  const [startDate, setStartDate] = useState<string | undefined>(undefined);
  // Secuencia de días (2026-06-13): este día está BLOQUEADO (faltan días anteriores) o ANULADO.
  const [locked, setLocked] = useState(false);
  const [anulado, setAnulado] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);

  useEffect(() => {
    if (!Number.isInteger(week) || !Number.isInteger(idx)) { navigate("/atleta", { replace: true }); return; }
    let on = true;
    setRows(null); setLoadError(false);
    setFecha(null); setFechaSheet(null); setOcupadas([]);
    setLocked(false); setAnulado(false);
    // D5: si el plan falla, el rechazo cae al catch general (loadError) — nada de degradar en
    // silencio a barra de 20 kg. El plan null RESUELTO (sin plan asignado) sigue siendo legítimo.
    Promise.all([me.getMePlan(), me.getMeSessions(week)])
      .then(([plan, views]: [MePlanView, SessionView[]]) => {
        if (!on) return;
        setBarKg(barKgForSexo(plan.athlete.sexo));
        setStartDate(plan.plan?.startDate);
        const s = views.find((v) => v.sessionIdx === idx);
        // Fecha de ESTA sesión (D5/D12): mi día/turno + las fechas de las OTRAS sesiones de la
        // semana. Sólo cuenta como "ocupada" un día DISTINTO (los gemelos AM/PM del mismo día
        // comparten fecha — D9). Resolución: editar conserva su fecha; hoy ocupada → sheet
        // arriba (antes de registrar); si no, HOY en silencio (cero fricción).
        const day = s?.day ?? idx + 1;
        setMyDay(day);
        setMyTurno(s?.turno);
        // Secuencia de días: este día está bloqueado si algún día anterior no está resuelto;
        // resuelto = la sesión tiene registro (fecha = hecho) o está anulada (espejo del backend).
        const allIdxs = views.map((v) => v.sessionIdx);
        const dayOfFn = (i: number): number => views.find((v) => v.sessionIdx === i)?.day ?? i + 1;
        // Resuelto = anulado o registrado (con fecha) — espejo EXACTO del gate del backend.
        const resolvedSet = new Set(views.filter((v) => v.anulado === true || v.fecha != null).map((v) => v.sessionIdx));
        setAnulado(s?.anulado === true);
        setLocked(!resolvedSet.has(idx) && !priorDaysResolved(allIdxs, (i) => resolvedSet.has(i), dayOfFn, idx));
        const tomadas = views
          .filter((v) => v.sessionIdx !== idx && v.fecha != null && (v.day ?? v.sessionIdx + 1) !== day)
          .map((v) => v.fecha!);
        setOcupadas(tomadas);
        if (s?.fecha != null) setFecha(s.fecha);
        else if (tomadas.includes(hoy)) setFechaSheet("conflicto");
        else setFecha(hoy);
        setRows((s?.exercises ?? []).map((e) => {
          const fromActual = e.actual?.sets;
          // Flujo MARCAR-A-MEDIDA (rediseño 0110): una sesión fresca nace SIN marcar (done:false) —
          // el atleta confirma cada serie a medida que la hace. Al re-editar una sesión ya guardada,
          // se respetan los estados guardados (fromActual).
          const series: SetRow[] = fromActual && fromActual.length > 0
            ? fromActual.map((x) => ({ kg: x.kg, reps: x.reps, done: x.done }))
            : Array.from({ length: e.sets }, () => ({ kg: e.targetKg, reps: e.reps, done: false }));
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
  }, [week, idx, navigate, reload, hoy]);

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
      await me.putMeSession(week, idx, { fecha: fecha ?? hoy, actuals });
      navigate(`/atleta/entreno/${week}/${idx}/victoria`);
    } catch (e) {
      // Red de seguridad server-side (D5): una carrera entre dispositivos puede dejar la fecha
      // tomada recién al guardar → reabrimos el sheet en vez de un error opaco.
      if (e instanceof FechaOcupadaError) { setFechaSheet("conflicto"); return; }
      // Secuencia de días: el gate server-side rechazó por días anteriores sin resolver.
      if (e instanceof DiaBloqueadoError) { setError("Completá el día anterior antes de registrar este."); return; }
      setError(e instanceof Error ? e.message : "No se pudo guardar");
    }
    finally { setBusy(false); }
  }, [rows, week, idx, navigate, fecha, hoy]);

  // Secuencia de días (2026-06-13): anular el entreno (falló/canceló) → vuelve al inicio.
  const doAnular = useCallback(async () => {
    if (!window.confirm("¿Anular este entreno? Queda marcado como saltado (sin volumen). Podés reactivarlo después.")) return;
    setActionBusy(true); setError(null);
    try {
      await me.anularMeSession(week, idx);
      navigate("/atleta");
    } catch (e) {
      if (e instanceof DiaBloqueadoError) { setError("Completá el día anterior antes de anular este."); return; }
      setError(e instanceof Error ? e.message : "No se pudo anular");
    } finally { setActionBusy(false); }
  }, [week, idx, navigate]);

  // Reactivar (des-anular) → el día vuelve a pendiente; recargamos para registrarlo normal.
  const doReactivar = useCallback(async () => {
    setActionBusy(true); setError(null);
    try {
      await me.desanularMeSession(week, idx);
      setReload((r) => r + 1);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo reactivar");
    } finally { setActionBusy(false); }
  }, [week, idx]);

  if (rows === null) return <div style={{ padding: 20, color: "var(--wl-muted)", fontFamily: "var(--mono)" }}>Cargando…</div>;

  // NOTE: rendered inside AthleteShell's `<main className="ho-scroll">` — no agregar otro wrapper ho-scroll.
  return (
    <div>
      <BackButton ariaLabel="Volver" onClick={() => (started ? setStarted(false) : navigate("/atleta"))} style={{ marginBottom: 6 }} />
      <div style={{ fontFamily: "var(--wl-display)", fontWeight: 800, fontSize: 20, color: "var(--wl-text)" }}>Entreno · sem {week} · día {myDay}{myTurno ? ` · ${myTurno}` : ""}</div>

      {loadError ? (
        <div role="alert" style={{ marginTop: 14, fontFamily: "var(--mono)", fontSize: 11, color: "var(--wl-danger)" }}>
          No se pudo cargar la sesión.{" "}
          <RetryButton onClick={() => setReload((r) => r + 1)} />
        </div>
      ) : locked ? (
        // Secuencia de días: no se puede registrar este día sin resolver los anteriores.
        <div style={{ marginTop: 18, textAlign: "center", fontFamily: "var(--mono)", fontSize: 12, color: "var(--wl-muted)" }}>
          <div style={{ fontSize: 30, marginBottom: 8 }} aria-hidden>🔒</div>
          Completá el día anterior para desbloquear este.
        </div>
      ) : anulado ? (
        // Día anulado: sin volumen; ofrecemos reactivarlo (des-anular) para registrarlo normal.
        <div style={{ marginTop: 14 }}>
          <div style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--wl-muted)", marginBottom: 12 }}>
            Este entreno está <strong style={{ color: "var(--wl-text)" }}>anulado</strong> (lo saltaste). No suma volumen.
          </div>
          <button type="button" className="wl-btn wl-btn--primary" style={{ width: "100%" }} disabled={actionBusy} onClick={() => void doReactivar()}>
            Reactivar este entreno
          </button>
        </div>
      ) : rows.length === 0 ? (
        <div style={{ marginTop: 14, fontFamily: "var(--mono)", fontSize: 11, color: "var(--wl-muted)" }}>No hay sesión para este día.</div>
      ) : !started ? (
        <div style={{ marginTop: 12 }}>
          <ResumenDia
            rows={rows.map((r) => ({ movementName: r.movementName, sets: r.sets, reps: r.reps, kg: r.series[0]?.kg ?? r.targetKg, pct: r.pct }))}
            barKg={barKg}
            fecha={fecha ?? hoy}
            onFechaTap={() => setFechaSheet("editar")}
            onStart={() => { setCur(0); setStarted(true); }}
            onAnular={() => void doAnular()}
          />
        </div>
      ) : (
        <div style={{ marginTop: 12 }}>
          <SessionAccordion
            rows={rows} open={cur} onOpen={setCur} barKg={barKg} busy={busy}
            onPatchSet={patchSet}
            onSubstitute={() => setSubOpen(true)}
            onMovementNotDone={movementNotDone}
            onFinish={() => void save()}
          />
        </div>
      )}
      {error && <div role="alert" style={{ marginTop: 10, color: "var(--wl-danger)", fontFamily: "var(--mono)", fontSize: 11 }}>{error}</div>}

      {subOpen && rows[cur] && (
        <SubstituteSheet open movementId={rows[cur]!.movementId} onClose={() => setSubOpen(false)} onPick={pickSub} />
      )}

      {fechaSheet && (
        <FechaSheet
          open
          motivo={fechaSheet}
          hoy={hoy}
          ocupadas={ocupadas}
          {...(startDate ? { fueraDeSemana: (f: string) => fueraDeSemana(f, startDate, week) } : {})}
          onPick={(f) => { setFecha(f); setFechaSheet(null); }}
          onClose={() => setFechaSheet(null)}
        />
      )}
    </div>
  );
}
