import { useState } from "react";
import { DiscRow } from "../../../ui/Disc";

export interface SetRow { kg?: number; reps?: number; done: boolean; }

function Stepper({ value, onChange, step = 1, min = 0, unit, label }: {
  value?: number; onChange: (v: number) => void; step?: number; min?: number; unit: string; label: string;
}) {
  return (
    <div className="et-step" role="group" aria-label={label}>
      <button type="button" className="et-step__b" aria-label={`menos ${label}`} onClick={() => onChange(Math.max(min, (Number(value) || 0) - step))}>−</button>
      <div className="et-step__v">{value == null ? "" : value}<span className="et-step__u">{unit}</span></div>
      <button type="button" className="et-step__b" aria-label={`más ${label}`} onClick={() => onChange((Number(value) || 0) + step)}>+</button>
    </div>
  );
}

function WorkSetRow({ i, n, s, barKg, isNext, onToggle, onPatch }: {
  i: number; n: number; s: SetRow; barKg: number; isNext: boolean;
  onToggle: () => void; onPatch: (p: Partial<SetRow>) => void;
}) {
  const [edit, setEdit] = useState(false);
  const done = s.done;
  return (
    <div className={"et-set" + (done ? " is-done" : "") + (edit ? " is-editing" : "") + (isNext ? " is-next" : "")}>
      <button type="button" className="et-set__main" onClick={onToggle} aria-pressed={done}
        aria-label={`serie ${i + 1} de ${n}, ${s.kg != null ? s.kg : "—"} kilos por ${s.reps ?? "—"} reps, ${done ? "hecha" : "pendiente"}`}>
        <span className="et-set__num" aria-hidden>{done ? "✓" : i + 1}</span>
        <span className="et-set__mid">
          <span className="et-set__serie">Serie {i + 1}<span className="et-set__of">/{n}</span></span>
          {s.kg != null && <span className="et-set__bar"><DiscRow kg={s.kg} barKg={barKg} size={30} /></span>}
        </span>
        <span className="et-set__nums">
          <span className="et-set__kg">{s.kg != null ? s.kg : "—"}<span className="et-set__u"> kg</span></span>
          <span className="et-set__reps">{s.reps != null ? `× ${s.reps} ${s.reps === 1 ? "rep" : "reps"}` : "—"}</span>
        </span>
      </button>

      <button type="button" className="et-set__edit" aria-label={`ajustar serie ${i + 1}`} onClick={() => setEdit((e) => !e)}>{edit ? "▴" : "✎"}</button>

      {edit && (
        <div className="et-set__editor">
          <Stepper label={`kg serie ${i + 1}`} value={s.kg} unit="kg" step={1} onChange={(v) => onPatch({ kg: v })} />
          <Stepper label={`reps serie ${i + 1}`} value={s.reps} unit="reps" step={1} onChange={(v) => onPatch({ reps: v })} />
          <div className="et-set__editrow">
            <button type="button" className="et-minibtn" onClick={() => onPatch({ done: !done })}>{done ? "no la hice" : "sí la hice"}</button>
            <button type="button" className="et-minibtn is-accent" onClick={() => setEdit(false)}>✓ listo</button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Series de trabajo: filas tocables con discos (vía DiscRow). Nacen al target con `done:true`
 *  (adherencia por defecto — decisión owner); se ven como ✓ y se tocan para des-marcar excepciones,
 *  o ✎ para ajustar kg/reps. Glow "spotlight" en la próxima serie PENDIENTE (si des-marcás alguna). */
export function WorkSetsSection({ series, barKg, onPatchSet }: {
  series: SetRow[]; barKg: number; onPatchSet: (i: number, p: Partial<SetRow>) => void;
}) {
  const nDone = series.filter((s) => s.done).length;
  const vol = series.filter((s) => s.done).reduce((a, s) => a + (s.kg || 0) * (s.reps || 0), 0);
  const all = series.length > 0 && nDone === series.length;
  const nextPending = series.findIndex((s) => !s.done); // -1 = ninguna pendiente

  return (
    <div className="et-worksets">
      <div className="et-worksets__head">
        <span className="et-worksets__title">Series de trabajo</span>
        <span className={"et-worksets__count" + (all ? " is-all" : "")}>{nDone}/{series.length}{vol > 0 ? ` · ${vol.toLocaleString("es-CL")} kg` : ""}</span>
      </div>
      <div className="et-worksets__track" aria-hidden><span className="et-worksets__fill" style={{ width: `${series.length ? (nDone / series.length) * 100 : 0}%` }} /></div>

      <div className="et-worksets__rows">
        {series.map((s, i) => (
          <WorkSetRow key={i} i={i} n={series.length} s={s} barKg={barKg}
            isNext={i === nextPending}
            onToggle={() => onPatchSet(i, { done: !s.done })}
            onPatch={(p) => onPatchSet(i, p)} />
        ))}
      </div>

      {all && (
        <div className="et-worksets__complete">
          <span className="et-worksets__complete-ic" aria-hidden>✓</span>
          {series.length} series listas · {vol.toLocaleString("es-CL")} kg · tocá una para des-marcar
        </div>
      )}
    </div>
  );
}
