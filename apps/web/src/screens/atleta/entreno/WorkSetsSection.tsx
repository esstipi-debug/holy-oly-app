import { useState } from "react";
import { useTranslation } from "react-i18next";
import { DiscRow } from "../../../ui/Disc";
import { useFormat } from "../../../lib/useFormat";

export interface SetRow { kg?: number; reps?: number; done: boolean; }

function Stepper({ value, onChange, step = 1, min = 0, unit, label }: {
  value?: number; onChange: (v: number) => void; step?: number; min?: number; unit: string; label: string;
}) {
  const { t } = useTranslation("atleta");
  return (
    <div className="et-step" role="group" aria-label={label}>
      <button type="button" className="et-step__b" aria-label={t("wsStepLess", { label })} onClick={() => onChange(Math.max(min, (Number(value) || 0) - step))}>−</button>
      <div className="et-step__v">{value == null ? "" : value}<span className="et-step__u">{unit}</span></div>
      <button type="button" className="et-step__b" aria-label={t("wsStepMore", { label })} onClick={() => onChange((Number(value) || 0) + step)}>+</button>
    </div>
  );
}

function WorkSetRow({ i, n, s, barKg, hidden, isNext, onToggle, onPatch }: {
  i: number; n: number; s: SetRow; barKg: number; hidden: boolean; isNext: boolean;
  onToggle: () => void; onPatch: (p: Partial<SetRow>) => void;
}) {
  const { t } = useTranslation("atleta");
  const [edit, setEdit] = useState(false);
  const done = s.done;
  return (
    <div className={"et-set" + (done ? " is-done" : "") + (hidden ? " is-hidden" : "") + (edit ? " is-editing" : "") + (isNext ? " is-next" : "")}>
      <button type="button" className="et-set__main" onClick={onToggle} aria-pressed={done}
        aria-label={t("wsSetAria", { index: i + 1, total: n, kg: s.kg != null ? s.kg : "—", reps: s.reps ?? "—", status: done ? t("wsStatusDone") : t("wsStatusPending") })}>
        <span className="et-set__num" aria-hidden>{done ? "✓" : i + 1}</span>
        <span className="et-set__mid">
          <span className="et-set__serie">{t("wsSerie", { index: i + 1 })}<span className="et-set__of">/{n}</span></span>
          {s.kg != null && <span className="et-set__bar"><DiscRow kg={s.kg} barKg={barKg} size={30} /></span>}
        </span>
        <span className="et-set__nums">
          <span className="et-set__kg">{s.kg != null ? s.kg : "—"}<span className="et-set__u"> kg</span></span>
          <span className="et-set__reps">{s.reps != null ? `× ${t("wsReps", { count: s.reps })}` : "—"}</span>
        </span>
      </button>

      <button type="button" className="et-set__edit" aria-label={t("wsAdjustSet", { index: i + 1 })} onClick={() => setEdit((e) => !e)}>{edit ? "▴" : "✎"}</button>

      {edit && (
        <div className="et-set__editor">
          <Stepper label={t("wsKgSet", { index: i + 1 })} value={s.kg} unit="kg" step={1} onChange={(v) => onPatch({ kg: v })} />
          <Stepper label={t("wsRepsSet", { index: i + 1 })} value={s.reps} unit="reps" step={1} onChange={(v) => onPatch({ reps: v })} />
          <div className="et-set__editrow">
            <button type="button" className="et-minibtn" onClick={() => onPatch({ done: !done })}>{done ? t("wsDidNot") : t("wsDidIt")}</button>
            <button type="button" className="et-minibtn is-accent" onClick={() => setEdit(false)}>✓ {t("wsReady")}</button>
          </div>
        </div>
      )}
    </div>
  );
}

/** Series de trabajo (rediseño 0110, marcar-a-medida): filas tocables con discos (vía DiscRow,
 *  intocable) que SE OCULTAN al completarse. Tap = marcar → se colapsa y queda la siguiente activa
 *  (glow). ✎ abre el editor (kg/reps con steppers + "no la hice"). Las series nacen SIN marcar. */
export function WorkSetsSection({ series, barKg, onPatchSet }: {
  series: SetRow[]; barKg: number; onPatchSet: (i: number, p: Partial<SetRow>) => void;
}) {
  const { t } = useTranslation("atleta");
  const fmt = useFormat();
  const [reveal, setReveal] = useState(false);
  const nDone = series.filter((s) => s.done).length;
  const vol = series.filter((s) => s.done).reduce((a, s) => a + (s.kg || 0) * (s.reps || 0), 0);
  const all = series.length > 0 && nDone === series.length;
  const nextPending = series.findIndex((s) => !s.done);

  return (
    <div className="et-worksets">
      <div className="et-worksets__head">
        <span className="et-worksets__title">{t("wsTitle")}</span>
        <span className={"et-worksets__count" + (all ? " is-all" : "")}>{nDone}/{series.length}{vol > 0 ? ` · ${fmt.number(vol)} kg` : ""}</span>
      </div>
      <div className="et-worksets__track" aria-hidden><span className="et-worksets__fill" style={{ width: `${series.length ? (nDone / series.length) * 100 : 0}%` }} /></div>

      <div className="et-worksets__rows">
        {series.map((s, i) => (
          <WorkSetRow key={i} i={i} n={series.length} s={s} barKg={barKg}
            hidden={s.done && !reveal} isNext={i === nextPending}
            onToggle={() => onPatchSet(i, { done: !s.done })}
            onPatch={(p) => onPatchSet(i, p)} />
        ))}
      </div>

      {nDone > 0 && !all && (
        <button type="button" className="et-worksets__reveal" onClick={() => setReveal((v) => !v)}>
          {reveal ? t("wsHideDone") : t("wsShowDone", { count: nDone })}
        </button>
      )}
      {all && (
        <div className="et-worksets__complete">
          <span className="et-worksets__complete-ic" aria-hidden>✓</span>
          {t("wsAllComplete", { count: series.length, vol: fmt.number(vol) })}
          <button type="button" className="et-worksets__re" onClick={() => setReveal((v) => !v)}>{reveal ? t("wsHide") : t("wsReview")}</button>
        </div>
      )}
    </div>
  );
}
