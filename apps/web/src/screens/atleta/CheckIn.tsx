import { useEffect, useRef, useState } from "react";
import { WELLNESS_ITEMS, goodness, type DayLog, type DayLogInput, type WellnessAnswers } from "@holy-oly/core";
import type { CheckinVariant } from "./prefs";
import { Face, Check } from "./primitives";

const GOOD_WORD: Record<number, string> = { 5: "Genial", 4: "Bien", 3: "Ahí va", 2: "Flojo", 1: "Difícil" };
type Item = (typeof WELLNESS_ITEMS)[number];

function FaceRow({ item, value, onPick }: { item: Item; value: number | undefined; onPick: (p: number) => void }) {
  return (
    <div>
      <div className="ho-faces">
        {[1, 2, 3, 4, 5].map((p) => (
          <button key={p} className={"ho-face" + (value === p ? " sel" : "")} onClick={() => onPick(p)} aria-label={`${item.label} ${p}`}>
            <Face level={goodness(p, item.highBad)} />
          </button>
        ))}
      </div>
      <div className="ho-facescale"><span>{item.lo}</span><span>{item.hi}</span></div>
    </div>
  );
}

function FaceDial({ item, value, onPick }: { item: Item; value: number; onPick: (p: number) => void }) {
  const trackRef = useRef<HTMLDivElement>(null);
  const setFromX = (clientX: number): void => {
    const el = trackRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const f = Math.max(0, Math.min(1, (clientX - r.left) / r.width));
    onPick(Math.round(1 + f * 4));
  };
  const onDown = (e: React.PointerEvent): void => {
    setFromX(e.clientX);
    const move = (ev: PointerEvent): void => setFromX(ev.clientX);
    const up = (): void => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  };
  const g = goodness(value, item.highBad);
  const pct = ((value - 1) / 4) * 100;
  return (
    <div>
      <div className="ho-bigface">
        <div className="ho-bigface__circle" style={{ transform: `scale(${0.92 + g * 0.03})` }}><Face level={g} /></div>
        <div className="ho-bigface__word">{GOOD_WORD[g]}</div>
      </div>
      <div className="ho-slider">
        <div className="ho-slider__track" ref={trackRef} onPointerDown={onDown}>
          <div className="ho-slider__fill" style={{ width: `${pct}%` }} />
          <div className="ho-slider__pegs">{[1, 2, 3, 4, 5].map((p) => <span key={p} className="ho-slider__peg" />)}</div>
          <div className="ho-slider__knob" style={{ left: `${pct}%` }} />
        </div>
        <div className="ho-slider__nums">
          {[1, 2, 3, 4, 5].map((p) => (
            <button key={p} className={value === p ? "on" : ""} onClick={() => onPick(p)}>{p}</button>
          ))}
        </div>
        <div className="ho-facescale" style={{ marginTop: 2 }}><span>{item.lo}</span><span>{item.hi}</span></div>
      </div>
    </div>
  );
}

function WeightStep({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  const step = (d: number): void => onChange(Math.round((value + d) * 10) / 10);
  return (
    <div className="ho-wt">
      <div className="ho-wt__dial">
        <button className="ho-wt__step" onClick={() => step(-0.1)} aria-label="menos">−</button>
        <div style={{ textAlign: "center" }}>
          <div className="ho-wt__val">{value.toFixed(1)}</div>
          <div className="ho-wt__unit">kg</div>
        </div>
        <button className="ho-wt__step" onClick={() => step(0.1)} aria-label="más">+</button>
      </div>
    </div>
  );
}

export function CheckIn({ variant, initial, onClose, onDone }: {
  variant: CheckinVariant;
  initial?: DayLog | null;
  onClose: () => void;
  onDone: (input: DayLogInput) => void | Promise<void>;
}) {
  const items = WELLNESS_ITEMS;
  const total = items.length + 1; // + peso
  const [step, setStep] = useState(0);
  const [maxReached, setMax] = useState(0);
  const [answers, setAnswers] = useState<Partial<WellnessAnswers>>(() =>
    initial
      ? { fatiga: initial.fatiga, dolor: initial.dolor, estres: initial.estres, humor: initial.humor, motivacion: initial.motivacion, sueno: initial.sueno }
      : {},
  );
  const [weight, setWeight] = useState<number>(initial?.weight ?? 80);
  const [finished, setFinished] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const advTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const go = (n: number): void => { clearTimeout(advTimer.current); setStep(n); setMax((m) => Math.max(m, n)); };
  useEffect(() => () => clearTimeout(advTimer.current), []);

  const pickTap = (item: Item, p: number): void => {
    setAnswers((a) => ({ ...a, [item.field]: p }));
    clearTimeout(advTimer.current);
    advTimer.current = setTimeout(() => go(step + 1), 300);
  };
  const pickDial = (item: Item, p: number): void => setAnswers((a) => ({ ...a, [item.field]: p }));

  const finish = async (includeWeight: boolean): Promise<void> => {
    const input: DayLogInput = {
      fatiga: answers.fatiga ?? 3, dolor: answers.dolor ?? 3, estres: answers.estres ?? 3,
      humor: answers.humor ?? 3, motivacion: answers.motivacion ?? 3, sueno: answers.sueno ?? 3,
      ...(includeWeight ? { weight } : {}),
    };
    setBusy(true);
    setError(null);
    try {
      await onDone(input);
      setFinished(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "No se pudo guardar");
    } finally {
      setBusy(false);
    }
  };

  if (finished) {
    return (
      <div className="ho-checkin">
        <div className="ho-cidone">
          <div className="ho-cidone__ring"><Check size={42} /></div>
          <div className="ho-cidone__h">¡Listo!</div>
          <div className="ho-cidone__b">Registramos tu día. Esto alimenta tu tendencia — no un puntaje para competir. Volvé mañana, sin presión.</div>
          <button className="wl-btn wl-btn--ghost" style={{ marginTop: 6 }} onClick={onClose}>Volver al inicio</button>
        </div>
      </div>
    );
  }

  const onWeight = step === items.length;
  const item = onWeight ? null : items[step]!;

  return (
    <div className="ho-checkin" role="dialog" aria-label="Check-in de hoy">
      <div className="ho-ci__top">
        <button className="ho-ci__close" onClick={step === 0 ? onClose : () => go(step - 1)} aria-label="atrás">{step === 0 ? "✕" : "‹"}</button>
        <div className="ho-ci__seg">
          {Array.from({ length: total }).map((_, i) => (
            <i key={i} className={i < step ? "done" : i === step ? "cur" : ""} onClick={() => i <= maxReached && go(i)} style={{ cursor: i <= maxReached ? "pointer" : "default" }} />
          ))}
        </div>
        <span className="ho-ci__count">{step + 1}/{total}</span>
      </div>

      <div className="ho-ci__body">
        <div className="ho-ci__card" key={step}>
          {onWeight ? (
            <>
              <div className="ho-ci__item">Peso corporal</div>
              <div className="ho-ci__q">¿Cuánto pesás hoy?</div>
              <WeightStep value={weight} onChange={setWeight} />
              <button className="ho-wt__skip" onClick={() => void finish(false)} disabled={busy}>Hoy no me pesé — saltar</button>
            </>
          ) : (
            <>
              <div className="ho-ci__item">{step + 1} · {item!.label}</div>
              <div className="ho-ci__q">{item!.q}</div>
              {variant === "dial"
                ? <FaceDial item={item!} value={answers[item!.field] ?? 3} onPick={(p) => pickDial(item!, p)} />
                : <FaceRow item={item!} value={answers[item!.field]} onPick={(p) => pickTap(item!, p)} />}
            </>
          )}
        </div>
      </div>

      <div className="ho-ci__foot">
        {error && <div role="alert" style={{ textAlign: "center", color: "var(--wl-danger)", fontFamily: "var(--mono)", fontSize: 11, marginBottom: 8 }}>{error}</div>}
        {onWeight ? (
          <button className="wl-btn wl-btn--primary" style={{ width: "100%" }} onClick={() => void finish(true)} disabled={busy}>{busy ? "Guardando…" : "Guardar check-in"}</button>
        ) : variant === "dial" ? (
          <button className="wl-btn" style={{ width: "100%" }} onClick={() => { if (!answers[item!.field]) pickDial(item!, 3); go(step + 1); }}>Siguiente</button>
        ) : (
          <div style={{ textAlign: "center", fontFamily: "var(--mono)", fontSize: 10, color: "var(--wl-muted)" }}>Tocá una carita</div>
        )}
      </div>
    </div>
  );
}
