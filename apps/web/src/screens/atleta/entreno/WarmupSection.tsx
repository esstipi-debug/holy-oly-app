import { useEffect, useState } from "react";
import type { WarmupSet } from "@holy-oly/core";
import { DiscRow } from "../../../ui/Disc";

/** Calentamiento clickeable CONTROLADO (el set de hechas vive en la card del ejercicio, para poder
 *  bloquear las series hasta calentar). Cada serie se toca para marcarla → se atenúa y se oculta;
 *  al completarse se colapsa a una píldora reexpandible. Discos vía DiscRow (intocable). Su tonelaje
 *  JAMÁS entra al monitor (regla de dominio: `warmupTonnage` se reporta aparte). Sin RPE. */
function WarmupRow({ s, barKg, done, onToggle, hidden, isNext }: {
  s: WarmupSet; barKg: number; done: boolean; onToggle: () => void; hidden: boolean; isNext: boolean;
}) {
  const label = s.label === "barra" ? "Barra" : `${s.pct}%`;
  return (
    <button
      type="button"
      className={"et-wrow" + (done ? " is-done" : "") + (hidden ? " is-hidden" : "") + (isNext ? " is-next" : "")}
      onClick={onToggle}
      aria-pressed={done}
      aria-label={`calentamiento ${label} ${s.kg} kilos por ${s.reps}, ${done ? "hecho" : "pendiente"}`}
    >
      <span className="et-wrow__check" aria-hidden>{done ? "✓" : ""}</span>
      <span className="et-wrow__pct">{label}</span>
      <span className="et-wrow__bar"><DiscRow kg={s.kg} barKg={barKg} /></span>
      <span className="et-wrow__kg">{s.kg}<span className="et-wrow__u"> kg × {s.reps}</span></span>
    </button>
  );
}

export function WarmupSection({ sets, barKg, doneSet, onToggle }: {
  sets: WarmupSet[]; barKg: number; doneSet: Set<number>; onToggle: (i: number) => void;
}) {
  const [open, setOpen] = useState(true);
  const total = sets.length;
  const allDone = total > 0 && doneSet.size === total;
  // al completar el calentamiento, se colapsa solo a la píldora (las series pasan a primer plano).
  useEffect(() => { if (allDone) setOpen(false); }, [allDone]);
  if (total === 0) return null;

  if (allDone && !open) {
    return (
      <button type="button" className="et-warmup-pill" onClick={() => setOpen(true)}>
        <span className="et-warmup-pill__ic" aria-hidden>✓</span>
        Calentamiento completo · {total} series
        <span className="et-warmup-pill__re">ver</span>
      </button>
    );
  }

  const nextPending = sets.findIndex((_, i) => !doneSet.has(i));
  return (
    <div className="et-warmup">
      <button type="button" className="et-warmup__head" onClick={() => setOpen((o) => !o)} aria-expanded={open}>
        <span className="et-warmup__title">Calentamiento · técnica + volumen de base</span>
        <span className="et-warmup__meta">
          <span className="et-warmup__count">{doneSet.size}/{total}</span>
          <span className="et-warmup__chev" aria-hidden>{open ? "▾" : "▸"}</span>
        </span>
      </button>
      {open && (
        <>
          <div className="et-warmup__track" aria-hidden><span className="et-warmup__fill" style={{ width: `${(doneSet.size / total) * 100}%` }} /></div>
          <div className="et-warmup__rows">
            {sets.map((s, i) => {
              const isDone = doneSet.has(i);
              return <WarmupRow key={i} s={s} barKg={barKg} done={isDone} hidden={isDone} isNext={i === nextPending} onToggle={() => onToggle(i)} />;
            })}
          </div>
          {doneSet.size > 0 && !allDone && (
            <div className="et-warmup__hint">{doneSet.size} hecha{doneSet.size > 1 ? "s" : ""} · se ocultan al marcarlas</div>
          )}
        </>
      )}
    </div>
  );
}
